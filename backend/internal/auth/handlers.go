package auth

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"server/internal/email"

	"golang.org/x/crypto/bcrypt"
)

// SignupRequest holds data for user sign-up.
type SignupRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginRequest holds data for user login.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Response holds a generic JSON message.
type Response struct {
	Message string `json:"message"`
}

// MakeSignupHandler registers new users and sends verification email.
func MakeSignupHandler(db *sql.DB, mailer *email.Client, jwtSecret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req SignupRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON payload", http.StatusBadRequest)
			return
		}
		defer r.Body.Close()

		// Validating username to have characters more than 3 and not more than 32/ username field should also not be empty
		if req.Username == "" {
			http.Error(w, "username is required", http.StatusBadRequest)
			return
		}
		if len(req.Username) < 3 || len(req.Username) > 32 {
			http.Error(w, "username must be between 3 to 32 characters", http.StatusBadRequest)
			return
		}

		// Hash password
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, "failed to hash password", http.StatusInternalServerError)
			return
		}

		// Generate verification token
		tokenBytes := make([]byte, 16)
		if _, err := rand.Read(tokenBytes); err != nil {
			http.Error(w, "failed to generate token", http.StatusInternalServerError)
			return
		}
		verifyToken := hex.EncodeToString(tokenBytes)

		// Insert user
		const q = `INSERT INTO users (username, email, password_hash, verification_token) VALUES ($1, $2, $3, $4)`
		if _, err := db.ExecContext(r.Context(), q, req.Username, req.Email, string(hash), verifyToken); err != nil {
			http.Error(w, "user already registered", http.StatusConflict)
			return
		}

		// Send verification email asynchronously and log errors incase it fails
		go func() {
			if err := mailer.SendVerificationEmail(req.Email, req.Username, verifyToken); err != nil {
				log.Printf("ERROR sending signup verification to %s: %v", req.Email, err)
			}
		}()

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(Response{Message: "Signup successful; please check your email to verify your account."})
	}
}

// MakeVerifyHandler confirms email using the token.
func MakeVerifyHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		token := r.URL.Query().Get("token")
		if token == "" {
			http.Error(w, "token is required", http.StatusBadRequest)
			return
		}

		const q = `UPDATE users SET verified = TRUE, verification_token = NULL WHERE verification_token = $1`
		res, err := db.ExecContext(r.Context(), q, token)
		if err != nil {
			http.Error(w, "verification failed", http.StatusInternalServerError)
			return
		}
		if cnt, _ := res.RowsAffected(); cnt == 0 {
			http.Error(w, "invalid or expired token", http.StatusBadRequest)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(Response{Message: "Email verified successfully."})
	}
}

// Updated MakeLoginHandler: creates a session row & sets a cookie instead of returning a JWT.
func MakeLoginHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 1) Only POST
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// 2) Parse credentials
		var req LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON payload", http.StatusBadRequest)
			return
		}
		defer r.Body.Close()

		// 3) Lookup user
		var (
			hash     string
			verified bool
			userID   int
		)
		const qUser = `
            SELECT id, password_hash, verified
            FROM users
            WHERE email = $1
        `
		if err := db.QueryRowContext(r.Context(), qUser, req.Email).Scan(&userID, &hash, &verified); err != nil {
			http.Error(w, "invalid credentials", http.StatusUnauthorized)
			return
		}
		if !verified {
			http.Error(w, "email not verified", http.StatusForbidden)
			return
		}

		// 4) Verify password
		if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
			http.Error(w, "invalid credentials", http.StatusUnauthorized)
			return
		}

		// 5) Generate a random session token
		tokenBytes := make([]byte, 16)
		if _, err := rand.Read(tokenBytes); err != nil {
			http.Error(w, "failed to generate session token", http.StatusInternalServerError)
			return
		}
		sessionToken := hex.EncodeToString(tokenBytes)

		// 6) Compute expiry (6 months from now)
		expiresAt := time.Now().AddDate(0, 6, 0)

		// 7) Insert session into Postgres
		const qSession = `
            INSERT INTO sessions (user_id, token, expires_at)
            VALUES ($1, $2, $3)
        `
		if _, err := db.ExecContext(r.Context(), qSession, userID, sessionToken, expiresAt); err != nil {
			http.Error(w, "failed to create session", http.StatusInternalServerError)
			return
		}

		// 8) Set cookie on response
		http.SetCookie(w, &http.Cookie{
			Name:     "session_token",
			Value:    sessionToken,
			Path:     "/",
			Expires:  expiresAt,
			HttpOnly: true,
			// Secure should be true in prod (HTTPS)
			Secure:   false,
			SameSite: http.SameSiteLaxMode,
		})

		// 9) Return 200 OK with simple JSON
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Message: "Login successful"})
	}
}

// MakeProfileHandler returns the logged-in user's basic info.
func MakeProfileHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 1) Extract user_id from context
		uidVal := r.Context().Value(ContextUserIDKey)
		userID, ok := uidVal.(int)
		if !ok {
			http.Error(w, "failed to get user from context", http.StatusInternalServerError)
			return
		}

		// 2) Query user info
		var (
			username string
			email    string
		)
		const q = `
            SELECT username, email
            FROM users
            WHERE id = $1
        `
		if err := db.QueryRowContext(r.Context(), q, userID).Scan(&username, &email); err != nil {
			http.Error(w, "user not found", http.StatusNotFound)
			return
		}

		// 3) Respond with JSON
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":       userID,
			"username": username,
			"email":    email,
		})
	}
}

// MakePasswordResetHandler handles reset requests and email.
func MakePasswordResetHandler(db *sql.DB, mailer *email.Client, jwtSecret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			// generate reset token
			emailAddr := r.URL.Query().Get("email")
			if emailAddr == "" {
				http.Error(w, "email is required", http.StatusBadRequest)
				return
			}
			// 1. Generate token & expiry
			tokenBytes := make([]byte, 16)
			rand.Read(tokenBytes)
			resetToken := hex.EncodeToString(tokenBytes)
			expires := time.Now().Add(time.Hour)

			// 2. Update users.reset_token & reset_expires
			const q1 = `UPDATE users SET reset_token=$1, reset_expires=$2 WHERE email=$3`
			if _, err := db.ExecContext(r.Context(), q1, resetToken, expires, emailAddr); err != nil {
				http.Error(w, "failed to set reset token", http.StatusInternalServerError)
				return
			}

			// 3. Lookup username for this email
			var username string
			const qUser = `SELECT username FROM users WHERE email=$1`
			if err := db.QueryRowContext(r.Context(), qUser, emailAddr).Scan(&username); err != nil {
				// If for some reason user row disappeared, just log and continue with email address in greeting
				log.Printf("WARN: could not find username for %s: %v", emailAddr, err)
				username = ""
			}

			// 4. Send password reset email with templates
			go func() {
				if err := mailer.SendResetPasswordEmail(emailAddr, username, resetToken); err != nil {
					log.Printf("ERROR sending password reset to %s: %v", emailAddr, err)
				}
			}()

			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(Response{Message: "Password reset email sent."})

		case http.MethodPut:
			// (no changes here, this only handles the token→password step)
			var req struct {
				Token       string `json:"token"`
				NewPassword string `json:"newPassword"`
			}
			json.NewDecoder(r.Body).Decode(&req)
			if req.Token == "" || req.NewPassword == "" {
				http.Error(w, "token and newPassword are required", http.StatusBadRequest)
				return
			}
			var expires time.Time
			const q2 = `SELECT reset_expires FROM users WHERE reset_token=$1`
			if err := db.QueryRowContext(r.Context(), q2, req.Token).Scan(&expires); err != nil {
				http.Error(w, "invalid token", http.StatusBadRequest)
				return
			}
			if time.Now().After(expires) {
				http.Error(w, "token expired", http.StatusBadRequest)
				return
			}
			hash, _ := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
			const q3 = `UPDATE users SET password_hash=$1, reset_token=NULL, reset_expires=NULL WHERE reset_token=$2`
			if _, err := db.ExecContext(r.Context(), q3, string(hash), req.Token); err != nil {
				http.Error(w, "failed to reset password", http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(Response{Message: "Password reset successful."})

		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}
