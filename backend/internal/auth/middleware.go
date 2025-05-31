package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v4"
)

// ContextKey is used to store values in context.
type ContextKey string

const (
	// ContextUserIDKey is the key for user_id in context
	ContextUserIDKey ContextKey = "user_id"
)

// RequireJWT creates middleware enforcing a valid JWT in Authorization header.
func RequireJWT(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, "missing or invalid Authorization header", http.StatusUnauthorized)
				return
			}
			tokenString := strings.TrimPrefix(authHeader, "Bearer ")

			token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(secret), nil
			})
			if err != nil || !token.Valid {
				http.Error(w, "invalid token", http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, "invalid token claims", http.StatusUnauthorized)
				return
			}

			uidFloat, ok := claims["user_id"].(float64)
			if !ok {
				http.Error(w, "user_id not found in token", http.StatusUnauthorized)
				return
			}
			uid := int(uidFloat)

			// Inject user_id into context
			ctx := context.WithValue(r.Context(), ContextUserIDKey, uid)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
