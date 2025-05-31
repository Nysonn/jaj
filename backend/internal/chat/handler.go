package chat

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"time"

	"server/internal/auth"

	"github.com/prometheus/client_golang/prometheus"
	"go.uber.org/zap"
	"google.golang.org/genai"
)

// promptRequest represents the student's request to the chat endpoint.
type promptRequest struct {
	Message string `json:"message"`
}

// promptResponse is the structure returned to the frontend.
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
		// 1. Extract user_id from context
		uidVal := r.Context().Value(auth.ContextUserIDKey)
		userID, _ := uidVal.(int) // Used for logging below

		// 2. Enforce order window (08:00–17:00)
		now := time.Now()
		start := time.Date(now.Year(), now.Month(), now.Day(), 8, 0, 0, 0, now.Location())
		end := time.Date(now.Year(), now.Month(), now.Day(), 17, 0, 0, 0, now.Location())
		if now.Before(start) || now.After(end) {
			http.Error(w, "orders are accepted only between 08:00 and 17:00", http.StatusForbidden)
			return
		}

		// 3. Decode student message
		var req promptRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON payload", http.StatusBadRequest)
			return
		}
		defer r.Body.Close()

		// 4. Query MCP server for catalog items
		mcpURL := os.Getenv("MCP_URL") + "/query"
		mcpReqBody, _ := json.Marshal(map[string]interface{}{
			"model":      "items",
			"fields":     []string{"name", "category", "price_ugx", "available"},
			"queryText":  req.Message,
			"maxResults": 10,
		})
		mcpResp, err := http.Post(mcpURL, "application/json", bytes.NewBuffer(mcpReqBody))
		if err != nil {
			logger.Error("MCP query failed", zap.Error(err), zap.Int("user_id", userID))
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer mcpResp.Body.Close()
		mcpData, _ := ioutil.ReadAll(mcpResp.Body)

		// 5. Build prompt for Gemini
		promptText := fmt.Sprintf(
			"User: %s\nCatalog: %s\nAssistant:",
			req.Message,
			string(mcpData),
		)

		// 6. Call Gemini via the SDK
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		// Read desired model from env (fallback to default)
		modelName := os.Getenv("GEMINI_MODEL")
		if modelName == "" {
			modelName = "gemini-2.0-flash"
		}

		genaiResp, err := genaiClient.Models.GenerateContent(
			ctx,
			modelName,
			genai.Text(promptText),
			nil, // no extra options
		)
		if err != nil {
			logger.Error("Gemini GenerateContent failed", zap.Error(err), zap.Int("user_id", userID))
			http.Error(w, "internal error contacting Gemini", http.StatusInternalServerError)
			return
		}
		replyText := genaiResp.Text()

		// 7. Increment Prometheus metric
		meter.WithLabelValues("chat_prompts").Inc()

		// 8. Send reply
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(promptResponse{Reply: replyText})

		logger.Info("Chat prompt processed", zap.Int("user_id", userID), zap.String("message", req.Message))
	}
}
