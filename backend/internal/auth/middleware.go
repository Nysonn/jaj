package auth

import (
	"context"
	"database/sql"
	"net/http"
	"time"
)

// ContextKey is used to store values in context.
type ContextKey string

const (
	// ContextUserIDKey is the key for user_id in context
	ContextUserIDKey ContextKey = "user_id"
)

// RequireSession creates middleware enforcing a valid session cookie.
func RequireSession(db *sql.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			//Allow preflight through without auth
			if r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			// 1) Read cookie
			cookie, err := r.Cookie("session_token")
			if err != nil {
				http.Error(w, "missing session", http.StatusUnauthorized)
				return
			}
			token := cookie.Value

			// 2) Lookup session in DB
			var userID int
			var expiresAt time.Time
			const q = `
                SELECT user_id, expires_at
                FROM sessions
                WHERE token = $1
            `
			row := db.QueryRowContext(r.Context(), q, token)
			if err := row.Scan(&userID, &expiresAt); err != nil {
				http.Error(w, "invalid session", http.StatusUnauthorized)
				return
			}

			// 3) Check expiry
			if time.Now().After(expiresAt) {
				http.Error(w, "session expired", http.StatusUnauthorized)
				return
			}

			// 4) Optionally: extend expiry on activity (sliding window)
			//    newExpiry := time.Now().AddDate(0, 6, 0)
			//    db.ExecContext(r.Context(), "UPDATE sessions SET expires_at = $1 WHERE token = $2", newExpiry, token)
			//
			//    And reset cookie Expires header if you choose sliding sessions.

			// 5) Inject userID into context
			ctx := context.WithValue(r.Context(), ContextUserIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
