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

// promptRequest represents the student's request payload.
type promptRequest struct {
	Message string `json:"message"`
}

// promptResponse is the structure we send back to the frontend.
type promptResponse struct {
	Reply string `json:"reply"`
}

// MakePromptHandler returns an http.HandlerFunc for /chat/prompt.
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

		// Log the user making the request
		logger.Info("Processing chat request", zap.Int("user_id", userID))

		// 2. Enforce order window (08:00–17:00).
		now := time.Now()
		start := time.Date(now.Year(), now.Month(), now.Day(), 8, 0, 0, 0, now.Location())
		end := time.Date(now.Year(), now.Month(), now.Day(), 17, 0, 0, 0, now.Location())
		if now.Before(start) || now.After(end) {
			http.Error(w,
				"Orders are accepted only between 08:00 and 17:00",
				http.StatusForbidden,
			)
			return
		}

		// 3. Decode student message.
		var req promptRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON payload", http.StatusBadRequest)
			return
		}
		defer r.Body.Close()

		// 4. Call MCP /query to look for matching items.
		mcpURL := os.Getenv("MCP_URL") + "/query"
		mcpReqBody, _ := json.Marshal(map[string]interface{}{
			"model":      "items",
			"fields":     []string{"id", "name", "category", "price_ugx", "available"},
			"queryText":  req.Message,
			"maxResults": 10,
		})

		mcpResp, err := http.Post(mcpURL, "application/json", bytes.NewBuffer(mcpReqBody))
		if err != nil {
			logger.Error("MCP /query request failed", zap.Error(err))
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer mcpResp.Body.Close()

		// Read and decode MCP's JSON response, expecting an array of objects.
		var items []map[string]interface{}
		if bodyBytes, err := io.ReadAll(mcpResp.Body); err != nil {
			logger.Error("failed to read MCP response body", zap.Error(err))
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		} else if err := json.Unmarshal(bodyBytes, &items); err != nil {
			logger.Error("failed to decode MCP response JSON", zap.Error(err))
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		// 5. If MCP returned no matching items, reply immediately.
		if len(items) == 0 {
			// Increment a metric for "no items found"
			meter.WithLabelValues("no_items_found").Inc()

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(promptResponse{
				Reply: "That product is not available at the moment.",
			})
			return
		}

		// 6. Build a system prompt to instruct Gemini how to use the items array.
		//    We include a JSON representation of the `items` slice directly in the prompt.
		systemPrompt := fmt.Sprintf(`
You are a JAJ ordering assistant. You have access to a single tool (MCP) that returns catalog items. The only valid products are these (exactly; do not invent new ones):
%s

When the user asks to buy groceries, check this list. If a product they request is not in this list or 'available': false, respond with "That product is not available at the moment." 
Otherwise, compute the price: multiply unit price by requested quantity. Then calculate the transport fee based on daily order count (≤3 → 1000 UGX; 4–6 → 2000 UGX; >6 → 3000 UGX). 
Finally, reply with a breakdown:
- Each item: name, quantity, unit price, subtotal 
- Transport fee 
- Grand total
Then ask "Do you confirm the contents of this order?"

If the user's message is not about ordering or asking for product prices—e.g. "What is biology?"—respond with: "Sorry, we cannot help you with that; our goal is to take orders and deliveries."
`, toJSON(items))

		// 7. Build a user prompt that contains exactly what the student typed.
		userPrompt := fmt.Sprintf(`User: "%s"`, req.Message)

		// 8. Call Gemini's GenerateContent API.
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()

		// Choose model (from ENV or default)
		modelName := os.Getenv("GEMINI_MODEL")
		if modelName == "" {
			modelName = "gemini-1.5-flash"
		}

		model := genaiClient.GenerativeModel(modelName)

		// Configure the model
		model.SystemInstruction = &genai.Content{
			Parts: []genai.Part{genai.Text(systemPrompt)},
		}

		// Generate content with streaming
		iter := model.GenerateContentStream(ctx, genai.Text(userPrompt))

		// 9. Stream Gemini's response back to the client as JSON
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)

		// Write opening of JSON object and "reply" key
		w.Write([]byte(`{"reply":"`))

		// Stream each chunk, escaping quotes/newlines
		for {
			resp, err := iter.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				logger.Error("Gemini iteration error", zap.Error(err))
				break
			}

			// Extract text from response
			for _, cand := range resp.Candidates {
				if cand.Content != nil {
					for _, part := range cand.Content.Parts {
						if txt, ok := part.(genai.Text); ok {
							// Escape any JSON-special characters
							escaped := strings.ReplaceAll(string(txt), `"`, `\"`)
							escaped = strings.ReplaceAll(escaped, "\n", `\n`)
							escaped = strings.ReplaceAll(escaped, "\r", `\r`)
							escaped = strings.ReplaceAll(escaped, "\t", `\t`)
							w.Write([]byte(escaped))

							// Flush the response
							if flusher, ok := w.(http.Flusher); ok {
								flusher.Flush()
							}
						}
					}
				}
			}
		}

		// Close JSON string/object
		w.Write([]byte(`"}`))

		// Increment metric for "successful prompts"
		meter.WithLabelValues("chat_success").Inc()
	}
}

// toJSON safely serializes the items slice to a JSON string.
func toJSON(items []map[string]interface{}) string {
	b, _ := json.Marshal(items)
	return string(b)
}
