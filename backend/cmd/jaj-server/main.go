package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/joho/godotenv"
	"go.uber.org/zap"
	"google.golang.org/genai"

	"server/internal/admin"
	"server/internal/auth"
	"server/internal/chat"
	"server/internal/config"
	"server/internal/db"
	"server/internal/email"
	"server/internal/monitoring"
	"server/internal/orders"
)

func main() {
	//Automatically load the environment variables
	_ = godotenv.Load()

	// 1. Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config load: %v", err)
	}

	// 2. Create a context for GenAI calls
	ctx := context.Background()

	// 3. Read the API key from env
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		log.Fatal("GEMINI_API_KEY must be set in environment")
	}

	// 4. Initialize the GenAI client
	genaiClient, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		log.Fatalf("failed to initialize Gemini SDK: %v", err)
	}

	// 5. Initialize logger & metrics
	logger := monitoring.NewLogger()
	registry := monitoring.NewRegistry()

	// 6. Connect to DB
	sqlDB, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		logger.Fatal("db connect failed", zap.Error(err))
	}
	defer sqlDB.Close()

	// 7. Run migrations
	driver, err := postgres.WithInstance(sqlDB, &postgres.Config{})
	if err != nil {
		logger.Fatal("migrate driver init failed", zap.Error(err))
	}
	m, err := migrate.NewWithDatabaseInstance("file://migrations", "postgres", driver)
	if err != nil {
		logger.Fatal("migrate init failed", zap.Error(err))
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		logger.Fatal("migrations apply failed", zap.Error(err))
	}
	logger.Info("migrations applied")

	// 8. Initialize SMTP client
	mailer := email.NewClient(cfg.SMTPHost, cfg.SMTPUser, cfg.SMTPPass)

	// 9. Set up HTTP handlers
	mux := http.NewServeMux()

	// Metrics endpoint
	mux.Handle("/metrics", monitoring.MakeMetricsHandler(registry))

	// Auth endpoints (no JWT required for signup, verify, login, password reset)
	mux.Handle("/signup", auth.MakeSignupHandler(sqlDB, mailer, cfg.JWTSecret))
	mux.Handle("/verify", auth.MakeVerifyHandler(sqlDB))
	mux.Handle("/login", auth.MakeLoginHandler(sqlDB, cfg.JWTSecret))
	mux.Handle("/password-reset", auth.MakePasswordResetHandler(sqlDB, mailer, cfg.JWTSecret))

	// Chat endpoint (requires JWT)
	mux.Handle(
		"/chat/prompt",
		auth.RequireJWT(cfg.JWTSecret)(
			chat.MakePromptHandler(sqlDB, logger, registry, genaiClient),
		),
	)

	// Orders endpoint (requires JWT)
	mux.Handle(
		"/orders",
		auth.RequireJWT(cfg.JWTSecret)(
			orders.MakeOrdersHandler(sqlDB, logger, registry, mailer),
		),
	)

	// Admin endpoints (protected by JWT)
	mux.Handle(
		"/admin/",
		auth.RequireJWT(cfg.JWTSecret)(
			admin.MakeAdminRouter(sqlDB, logger),
		),
	)

	// 10. Start server
	server := &http.Server{
		Addr:         cfg.ServerAddress,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	logger.Info("starting JAJ server", zap.String("addr", cfg.ServerAddress))
	if err := server.ListenAndServe(); err != nil {
		logger.Fatal("server failed", zap.Error(err))
	}
}
