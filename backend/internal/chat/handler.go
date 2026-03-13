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
	"server/internal/email"

	"github.com/prometheus/client_golang/prometheus"
	"go.uber.org/zap"
)

// ── TYPES ───────────────────────────────────────────────────────────────────────
type promptRequest struct {
	Message string `json:"message"`
}

type promptResponse struct {
	Reply string `json:"reply"`
}

type parsedProduct struct {
	Name     string `json:"name"`
	Quantity int    `json:"quantity"`
}

type confirmedItem struct {
	Name      string
	Quantity  int
	UnitPrice int
}

// ── GROQ CLIENT ─────────────────────────────────────────────────────────────────
type groqMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type groqRequest struct {
	Model    string        `json:"model"`
	Messages []groqMessage `json:"messages"`
}

type groqChoice struct {
	Message groqMessage `json:"message"`
}

type groqResponse struct {
	Choices []groqChoice `json:"choices"`
}

func callGroq(ctx context.Context, apiKey, model, systemPrompt, userPrompt string) (string, error) {
	reqBody, _ := json.Marshal(groqRequest{
		Model: model,
		Messages: []groqMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
	})

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewBuffer(reqBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("groq API error %d: %s", resp.StatusCode, string(body))
	}

	var groqResp groqResponse
	if err := json.Unmarshal(body, &groqResp); err != nil {
		return "", err
	}
	if len(groqResp.Choices) == 0 {
		return "", fmt.Errorf("groq returned no choices")
	}
	return groqResp.Choices[0].Message.Content, nil
}

// ── MAKE PROMPT HANDLER (WITH PERSISTENT "PENDING" STATE + SMTP EMAIL TEMPLATING) ───
func MakePromptHandler(
	db *sql.DB,
	logger *zap.Logger,
	meter *prometheus.CounterVec,
	groqAPIKey string,
	mailer *email.Client,
	baseURL string,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 1) Extract user_id from context (RequireJWT middleware).
		uidVal := r.Context().Value(auth.ContextUserIDKey)
		userID, ok := uidVal.(int)
		if !ok {
			logger.Error("invalid user ID in context")
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		logger.Info("Processing chat request", zap.Int("user_id", userID))

		// 2) Decode student message.
		var req promptRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON payload", http.StatusBadRequest)
			return
		}
		defer r.Body.Close()

		text := strings.TrimSpace(req.Message)
		lowerText := strings.ToLower(text)

		// ── STEP A: CHECK FOR ANY EXISTING PENDING ORDER FOR THIS USER ─────────────────────────
		var pendingOrderID int
		err := db.QueryRowContext(r.Context(),
			`SELECT id
			   FROM orders
			  WHERE user_id = $1 AND status = 'PENDING'
			  ORDER BY created_at DESC
			  LIMIT 1`,
			userID,
		).Scan(&pendingOrderID)

		if err != nil && err != sql.ErrNoRows {
			logger.Error("error looking up pending order", zap.Error(err))
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		hasPending := (err == nil)

		if hasPending {
			isConfirmation := strings.Contains(lowerText, "confirm")
			isCancellation := strings.Contains(lowerText, "cancel") || strings.Contains(lowerText, "cancelled")

			if isConfirmation {
				// ── USER CONFIRMS THE PENDING ORDER ────────────────────────────────────────────
				if _, err := db.ExecContext(r.Context(),
					`UPDATE orders SET status='CONFIRMED' WHERE id = $1`, pendingOrderID,
				); err != nil {
					logger.Error("failed to confirm order", zap.Error(err))
					http.Error(w, "internal error", http.StatusInternalServerError)
					return
				}

				// Recompute transport fee and total_cost
				var totalSubtotal, confirmedCount int
				rows, err := db.QueryContext(r.Context(),
					`SELECT oi.quantity, oi.unit_price
					   FROM order_items oi
					  WHERE oi.order_id = $1`, pendingOrderID,
				)
				if err != nil {
					logger.Error("failed to query order_items for confirmation", zap.Error(err))
					http.Error(w, "internal error", http.StatusInternalServerError)
					return
				}
				for rows.Next() {
					var qty, unitP int
					rows.Scan(&qty, &unitP)
					totalSubtotal += qty * unitP
				}
				rows.Close()

				today := time.Now().Truncate(24 * time.Hour)
				db.QueryRowContext(r.Context(),
					`SELECT COUNT(*)
					   FROM orders
					  WHERE user_id = $1
					    AND status = 'CONFIRMED'
					    AND created_at >= $2`,
					userID, today,
				).Scan(&confirmedCount)
				confirmedCount += 1
				transportFee := calculateTransportFee(confirmedCount)
				totalCost := totalSubtotal + transportFee

				if _, err := db.ExecContext(r.Context(),
					`UPDATE orders
						SET transport_fee = $1, total_cost = $2
					  WHERE id = $3`,
					transportFee, totalCost, pendingOrderID,
				); err != nil {
					logger.Error("failed to update transport & total cost", zap.Error(err))
				}

				go func(orderID, uID, tf, tc int) {
					var userEmail, username string
					if err := db.QueryRowContext(context.Background(),
						`SELECT email, email
						   FROM users
						  WHERE id = $1`, uID,
					).Scan(&userEmail, &username); err != nil {
						logger.Error("failed to lookup user email for confirmation", zap.Error(err))
						return
					}

					itemRows, _ := db.QueryContext(context.Background(),
						`SELECT i.name, oi.quantity, oi.unit_price
						   FROM order_items oi
						   JOIN items i ON oi.item_id = i.id
						  WHERE oi.order_id = $1`, orderID,
					)

					var tmplItems []struct {
						Name      string
						Quantity  int
						UnitPrice int
						Subtotal  int
					}
					for itemRows.Next() {
						var nm string
						var qty, unitP int
						itemRows.Scan(&nm, &qty, &unitP)
						tmplItems = append(tmplItems, struct {
							Name      string
							Quantity  int
							UnitPrice int
							Subtotal  int
						}{
							Name:      nm,
							Quantity:  qty,
							UnitPrice: unitP,
							Subtotal:  qty * unitP,
						})
					}
					itemRows.Close()

					data := email.OrderConfirmationData{
						Username:      username,
						OrderID:       orderID,
						Items:         tmplItems,
						TransportFee:  tf,
						TotalCost:     tc,
						PickupTime:    "18:00",
						PickupStation: "F2 17",
					}
					if err := mailer.SendOrderConfirmationEmail(userEmail, data); err != nil {
						logger.Error("failed to send order confirmation email", zap.Error(err))
					}
				}(pendingOrderID, userID, transportFee, totalCost)

				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(promptResponse{
					Reply: "Your order has been confirmed! We'll see you at 18:00 at F2 17.",
				})
				return
			}

			if isCancellation {
				// ── USER CANCELS THE PENDING ORDER ────────────────────────────────────────────
				if _, err := db.ExecContext(r.Context(),
					`UPDATE orders SET status='CANCELLED' WHERE id = $1`, pendingOrderID,
				); err != nil {
					logger.Error("failed to cancel order", zap.Error(err))
					http.Error(w, "internal error", http.StatusInternalServerError)
					return
				}

				go func(orderID, uID int) {
					var userEmail, username string
					if err := db.QueryRowContext(context.Background(),
						`SELECT email, email
						   FROM users
						  WHERE id = $1`, uID,
					).Scan(&userEmail, &username); err != nil {
						logger.Error("failed to lookup user email for cancellation", zap.Error(err))
						return
					}

					data := email.OrderCancellationData{
						Username: username,
						OrderID:  orderID,
					}
					if err := mailer.SendOrderCancellationEmail(userEmail, data); err != nil {
						logger.Error("failed to send cancellation email", zap.Error(err))
					}
				}(pendingOrderID, userID)

				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(promptResponse{
					Reply: "Your order has been cancelled. If you need anything else, just let me know.",
				})
				return
			}

			// If there's a PENDING but the user typed neither "confirm" nor "cancel",
			// cancel the old PENDING silently and move on to a fresh request.
			_, _ = db.ExecContext(r.Context(),
				`UPDATE orders SET status='CANCELLED' WHERE id = $1`, pendingOrderID,
			)
		}

		// ── NO EXISTING PENDING ORDER (OR IT JUST GOT CLEARED) ────────────────────────────
		// Proceed with fresh Phase 1 → Phase 2.

		// === PHASE 1: Ask Groq to extract product names & quantities ===
		phase1System := `
You are an assistant that parses grocery-ordering requests. The user will type something like:
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
Return only the JSON array, no markdown fences or extra text.
`
		phase1User := fmt.Sprintf(`User: "%s"`, req.Message)

		modelName := os.Getenv("GROQ_MODEL")
		if modelName == "" {
			modelName = "llama-3.3-70b-versatile"
		}

		ctx1, cancel1 := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel1()

		phase1JSON, err := callGroq(ctx1, groqAPIKey, modelName, phase1System, phase1User)
		if err != nil {
			logger.Error("Groq Phase1 error", zap.Error(err))
			http.Error(w, "internal error contacting Groq", http.StatusInternalServerError)
			return
		}

		// === LOG RAW PHASE 1 JSON ===
		fmt.Printf("\n--- PHASE 1 RAW JSON ---\n%s\n--- END PHASE 1 ---\n\n", phase1JSON)

		// === STRIP MARKDOWN FENCES (if any) ===
		stripped := strings.TrimSpace(phase1JSON)
		if strings.HasPrefix(stripped, "```") {
			lines := strings.SplitN(stripped, "\n", 3)
			if len(lines) == 3 {
				stripped = strings.TrimSpace(lines[1])
			}
		}
		phase1JSON = stripped

		var parsedList []parsedProduct
		if err := json.Unmarshal([]byte(phase1JSON), &parsedList); err != nil {
			parsedList = []parsedProduct{}
		}
		logger.Info("Phase1 parsed products", zap.Any("parsed", parsedList))

		if len(parsedList) == 0 {
			meter.WithLabelValues("off_topic").Inc()
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(promptResponse{
				Reply: "Sorry, we cannot help you with that, our goal is to take orders and deliveries.",
			})
			return
		}

		// === PHASE 2: Create the PENDING order and insert items under it ===
		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			logger.Error("begin transaction failed", zap.Error(err))
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		var newOrderID int
		err = tx.QueryRowContext(r.Context(),
			`INSERT INTO orders (user_id, status, transport_fee, total_cost, created_at)
			 VALUES ($1, 'PENDING', 0, 0, NOW())
			 RETURNING id`,
			userID,
		).Scan(&newOrderID)
		if err != nil {
			tx.Rollback()
			logger.Error("failed to create pending order", zap.Error(err))
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		var confirmedItems []confirmedItem
		totalSubtotal := 0
		mcpURL := os.Getenv("MCP_URL") + "/query"

		for _, p := range parsedList {
			mcpReqBody, _ := json.Marshal(map[string]interface{}{
				"model":      "items",
				"fields":     []string{"id", "name", "category", "price_ugx", "available"},
				"queryText":  p.Name,
				"maxResults": 1,
			})

			mcpResp, err := http.Post(mcpURL, "application/json", bytes.NewBuffer(mcpReqBody))
			if err != nil {
				tx.Rollback()
				logger.Error("MCP Phase2 request failed", zap.Error(err))
				http.Error(w, "internal error", http.StatusInternalServerError)
				return
			}
			bodyBytes, _ := io.ReadAll(mcpResp.Body)
			mcpResp.Body.Close()

			var itemsHit []map[string]interface{}
			if err := json.Unmarshal(bodyBytes, &itemsHit); err != nil {
				tx.Rollback()
				logger.Error("failed to decode MCP Phase2 JSON", zap.Error(err))
				http.Error(w, "internal error", http.StatusInternalServerError)
				return
			}

			if len(itemsHit) == 0 {
				tx.Rollback()
				meter.WithLabelValues("not_available").Inc()
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(promptResponse{
					Reply: fmt.Sprintf("That product \"%s\" is not available at the moment.", p.Name),
				})
				return
			}

			row := itemsHit[0]
			avail, _ := row["available"].(bool)
			if !avail {
				tx.Rollback()
				meter.WithLabelValues("not_available").Inc()
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(promptResponse{
					Reply: fmt.Sprintf("That product \"%s\" is not available at the moment.", p.Name),
				})
				return
			}

			priceFloat, _ := row["price_ugx"].(float64)
			price := int(priceFloat)
			subtotal := price * p.Quantity
			totalSubtotal += subtotal

			_, err = tx.ExecContext(r.Context(),
				`INSERT INTO order_items (order_id, item_id, quantity, unit_price)
				 VALUES ($1, $2, $3, $4)`,
				newOrderID,
				int(row["id"].(float64)),
				p.Quantity,
				price,
			)
			if err != nil {
				tx.Rollback()
				logger.Error("failed to insert order_item", zap.Error(err))
				http.Error(w, "internal error", http.StatusInternalServerError)
				return
			}

			confirmedItems = append(confirmedItems, confirmedItem{
				Name:      p.Name,
				Quantity:  p.Quantity,
				UnitPrice: price,
			})
		}

		if err := tx.Commit(); err != nil {
			logger.Error("transaction commit failed", zap.Error(err))
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		// 4) Build the summary prompt for user to confirm
		var lines []string
		for _, ci := range confirmedItems {
			sub := ci.Quantity * ci.UnitPrice
			lines = append(lines, fmt.Sprintf("- %s × %d @ %d UGX = %d UGX",
				ci.Name, ci.Quantity, ci.UnitPrice, sub,
			))
		}

		breakdown := "Okay, here's a summary of your order:\n\n"
		breakdown += "Items:\n" + strings.Join(lines, "\n") + "\n\n"
		breakdown += fmt.Sprintf("Subtotal: %d UGX\n\n", totalSubtotal)
		breakdown += "Once you confirm, we'll add a transport fee and give you the grand total.\n\n"
		breakdown += "Do you confirm the contents of this order?"

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(promptResponse{Reply: breakdown})
	}
}

// ── HELPERS ───────────────────────────────────────────────────────────────────────
func calculateTransportFee(orderCountToday int) int {
	switch {
	case orderCountToday <= 3:
		return 1000
	case orderCountToday <= 6:
		return 2000
	default:
		return 3000
	}
}
