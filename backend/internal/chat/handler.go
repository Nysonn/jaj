package chat

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"server/internal/auth"

	"github.com/google/generative-ai-go/genai"
	"github.com/prometheus/client_golang/prometheus"
	"go.uber.org/zap"
	"google.golang.org/api/iterator"
)

// promptRequest represents the student's JSON payload.
type promptRequest struct {
	Message string `json:"message"`
}

// promptResponse is the structure we send back to the frontend.
type promptResponse struct {
	Reply string `json:"reply"`
}

// parsedProduct is the structure we expect from Phase 1: Gemini's parsing.
type parsedProduct struct {
	Name     string `json:"name"`
	Quantity int    `json:"quantity"`
}

// MakePromptHandler returns an http.HandlerFunc for /chat/prompt,
// implementing a two-step (Option B) approach.
func MakePromptHandler(
	db *sql.DB,
	logger *zap.Logger,
	meter *prometheus.CounterVec,
	genaiClient *genai.Client,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 1. Extract user_id from context (populated by RequireJWT).
		uidVal := r.Context().Value(auth.ContextUserIDKey)
		userID, ok := uidVal.(int)
		if !ok {
			logger.Error("invalid user ID in context")
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		logger.Info("Processing chat request", zap.Int("user_id", userID))

		// Enforce order window (08:00–17:00).
		// now := time.Now()
		// start := time.Date(now.Year(), now.Month(), now.Day(), 8, 0, 0, 0, now.Location())
		// end := time.Date(now.Year(), now.Month(), now.Day(), 17, 0, 0, 0, now.Location())
		// if now.Before(start) || now.After(end) {
		// 	http.Error(w,
		// 		"Orders are accepted only between 08:00 and 17:00",
		// 		http.StatusForbidden,
		// 	)
		// 	return
		// }

		// 2. Decode student message.
		var req promptRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON payload", http.StatusBadRequest)
			return
		}
		defer r.Body.Close()

		// === PHASE 1: Ask Gemini to extract product names & quantities ===

		// Build Phase 1 system prompt: instruct Gemini to return JSON list
		// of { "name": <exact product name>, "quantity": <integer> }.
		phase1System := `
You are an assistant that parses grocery‐ordering requests. The user will type something like:
  "I want two Jesa Milk (2L) and three Nido Milk Powder (500g)."
Return a JSON array of objects, each with exactly two fields:
  "name": <exact product name string>,
  "quantity": <integer>.

If the user mentions a product but does not specify a number, assume quantity=1. 
Examples:
- Input: "I want Jesa Milk (2L) and one Coca-Cola (330ml)"
  → Output: [{"name":"Jesa Milk (2L)","quantity":1},{"name":"Coca-Cola (330ml)","quantity":1}]
- Input: "Give me two Lipton Black Tea (50g) and Detergent Powder (2kg)"
  → Output: [{"name":"Lipton Black Tea (50g)","quantity":2},{"name":"Detergent Powder (2kg)","quantity":1}]
- Input: "I need 5 bread loaves"
  → Output: [{"name":"bread loaves","quantity":5}]
- Input: "I would like to buy toothpaste"
  → Output: [{"name":"toothpaste","quantity":1}]
- If you cannot find any product names (e.g. "What is biology?"), return an empty JSON array: [].
`
		phase1User := fmt.Sprintf(`User: "%s"`, req.Message)

		// Call Gemini for Phase 1
		ctx1, cancel1 := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel1()

		modelName := os.Getenv("GEMINI_MODEL")
		if modelName == "" {
			modelName = "gemini-2.0-flash"
		}
		model := genaiClient.GenerativeModel(modelName)

		// Set the system instruction for Phase 1
		model.SystemInstruction = &genai.Content{
			Parts: []genai.Part{genai.Text(phase1System)},
		}
		iter1 := model.GenerateContentStream(ctx1, genai.Text(phase1User))

		// Collect the streamed response into a single string
		var phase1OutputBuilder strings.Builder
		for {
			resp, err := iter1.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				logger.Error("Gemini Phase1 error", zap.Error(err))
				http.Error(w, "internal error contacting Gemini", http.StatusInternalServerError)
				return
			}
			for _, cand := range resp.Candidates {
				if cand.Content != nil {
					for _, part := range cand.Content.Parts {
						if txt, ok := part.(genai.Text); ok {
							phase1OutputBuilder.WriteString(string(txt))
						}
					}
				}
			}
		}
		phase1JSON := phase1OutputBuilder.String()

		// === NEW: Log raw Phase 1 JSON to terminal ===
		fmt.Printf("\n--- PHASE 1 RAW JSON ---\n%s\n--- END PHASE 1 ---\n\n", phase1JSON)

		// === STRIP MARKDOWN FENCES FROM phase1JSON ===
		stripped := strings.TrimSpace(phase1JSON)
		if strings.HasPrefix(stripped, "```") {
			// Remove first line (```json or ```) and last line (```)
			lines := strings.SplitN(stripped, "\n", 3)
			if len(lines) == 3 {
				stripped = strings.TrimSpace(lines[1])
			}
		}
		// Now `stripped` should be something like: `[{"name":"milk","quantity":1}]`
		phase1JSON = stripped

		// Parse Phase 1 output as JSON array of parsedProduct
		var parsedList []parsedProduct
		if err := json.Unmarshal([]byte(phase1JSON), &parsedList); err != nil {
			// If JSON is malformed or empty, treat as no products found
			parsedList = []parsedProduct{}
		}
		logger.Info("Phase1 parsed products", zap.Any("parsed", parsedList))

		// If parsedList is empty, user is off-topic
		if len(parsedList) == 0 {
			meter.WithLabelValues("off_topic").Inc()
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(promptResponse{
				Reply: "Sorry, we cannot help you with that, our goal is to take orders and deliveries.",
			})
			return
		}

		// === PHASE 2: For each parsed product, query MCP to validate availability & get price ===

		// We'll build a slice of confirmed items with unit_price and quantity
		type confirmedItem struct {
			Name      string
			Quantity  int
			UnitPrice int
		}
		var confirmed []confirmedItem

		mcpURL := os.Getenv("MCP_URL") + "/query"
		for _, p := range parsedList {
			// Query MCP with the exact product name
			mcpReqBody, _ := json.Marshal(map[string]interface{}{
				"model":      "items",
				"fields":     []string{"id", "name", "category", "price_ugx", "available"},
				"queryText":  p.Name, // exact name
				"maxResults": 1,
			})

			mcpResp, err := http.Post(mcpURL, "application/json", bytes.NewBuffer(mcpReqBody))
			if err != nil {
				logger.Error("MCP Phase2 request failed", zap.Error(err))
				http.Error(w, "internal error", http.StatusInternalServerError)
				return
			}
			bodyBytes, _ := io.ReadAll(mcpResp.Body)
			mcpResp.Body.Close()

			var itemsHit []map[string]interface{}
			if err := json.Unmarshal(bodyBytes, &itemsHit); err != nil {
				logger.Error("failed to decode MCP Phase2 JSON", zap.Error(err))
				http.Error(w, "internal error", http.StatusInternalServerError)
				return
			}

			// If no match or not available, reject
			if len(itemsHit) == 0 {
				meter.WithLabelValues("not_available").Inc()
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(promptResponse{
					Reply: fmt.Sprintf("That product \"%s\" is not available at the moment.", p.Name),
				})
				return
			}
			// Expect exactly one hit; check availability
			row := itemsHit[0]
			avail, _ := row["available"].(bool)
			if !avail {
				meter.WithLabelValues("not_available").Inc()
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(promptResponse{
					Reply: fmt.Sprintf("That product \"%s\" is not available at the moment.", p.Name),
				})
				return
			}
			// Extract price_ugx
			priceFloat, _ := row["price_ugx"].(float64)
			price := int(priceFloat)

			confirmed = append(confirmed, confirmedItem{
				Name:      p.Name,
				Quantity:  p.Quantity,
				UnitPrice: price,
			})
		}

		// === PHASE 3: Build final Gemini prompt with confirmed items for pricing & confirmation ===

		// Build a "catalog snippet" listing each confirmed item with quantity & unit price
		var lines []string
		totalSubtotal := 0
		for _, ci := range confirmed {
			subtotal := ci.Quantity * ci.UnitPrice
			totalSubtotal += subtotal
			lines = append(lines, fmt.Sprintf(
				"- %s × %d @ %d UGX each = %d UGX",
				ci.Name, ci.Quantity, ci.UnitPrice, subtotal,
			))
		}
		// Calculate transport fee (assume this is first order of the day for simplicity)
		// In reality you would fetch today's confirmed orders count from DB and apply tiers
		transportFee := 1000
		// build the Phase3 system prompt
		phase3System := fmt.Sprintf(`
You are a JAJ ordering assistant. Here are the confirmed items the user wants:
%s

Subtotal: %d UGX
Transport fee: %d UGX
Grand total: %d UGX

Please present this breakdown in natural language and then ask: "Do you confirm the contents of this order?"
`, strings.Join(lines, "\n"), totalSubtotal, transportFee, totalSubtotal+transportFee)

		phase3User := `User: "Please generate the final confirmation message for these items."`

		ctx3, cancel3 := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel3()

		// Choose the same model as before
		model3 := genaiClient.GenerativeModel(modelName)
		model3.SystemInstruction = &genai.Content{
			Parts: []genai.Part{genai.Text(phase3System)},
		}
		iter3 := model3.GenerateContentStream(ctx3, genai.Text(phase3User))

		// 10. Stream Gemini's Phase 3 response back to the client
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"reply":"`))

		for {
			resp, err := iter3.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				logger.Error("Gemini Phase3 error", zap.Error(err))
				break
			}
			for _, cand := range resp.Candidates {
				if cand.Content != nil {
					for _, part := range cand.Content.Parts {
						if txt, ok := part.(genai.Text); ok {
							escaped := strings.ReplaceAll(string(txt), `"`, `\"`)
							escaped = strings.ReplaceAll(escaped, "\n", `\n`)
							escaped = strings.ReplaceAll(escaped, "\r", `\r`)
							escaped = strings.ReplaceAll(escaped, "\t", `\t`)
							w.Write([]byte(escaped))
							if flusher, ok := w.(http.Flusher); ok {
								flusher.Flush()
							}
						}
					}
				}
			}
		}

		w.Write([]byte(`"}`))
		meter.WithLabelValues("chat_success").Inc()
	}
}
