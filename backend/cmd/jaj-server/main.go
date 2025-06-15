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
	"github.com/google/generative-ai-go/genai"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
	"go.uber.org/zap"
	"google.golang.org/api/option"

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
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config load: %v", err)
	}

	ctx := context.Background()
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		log.Fatal("GEMINI_API_KEY must be set")
	}
	genaiClient, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		log.Fatalf("GenAI init failed: %v", err)
	}
	defer genaiClient.Close()

	logger := monitoring.NewLogger()
	registry := monitoring.NewRegistry()

	sqlDB, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		logger.Fatal("db connect failed", zap.Error(err))
	}
	defer sqlDB.Close()

	// Migrations
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

	mailer := email.NewClient(cfg.SMTPHost, cfg.SMTPUser, cfg.SMTPPass)

	mux := http.NewServeMux()
	mux.Handle("/metrics", monitoring.MakeMetricsHandler(registry))

	// Auth endpoints (public)
	mux.Handle("/signup", auth.MakeSignupHandler(sqlDB, mailer, cfg.JWTSecret))
	mux.Handle("/verify", auth.MakeVerifyHandler(sqlDB))
	mux.Handle("/login", auth.MakeLoginHandler(sqlDB)) // no jwtSecret now
	mux.Handle("/password-reset", auth.MakePasswordResetHandler(sqlDB, mailer, cfg.JWTSecret))

	// Profile endpoint (requires valid session cookie)
	mux.Handle(
		"/me",
		auth.RequireSession(sqlDB)(
			auth.MakeProfileHandler(sqlDB),
		),
	)

	baseURL := os.Getenv("BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}

	// Chat endpoint
	mux.Handle(
		"/chat/prompt",
		auth.RequireSession(sqlDB)(
			chat.MakePromptHandler(sqlDB, logger, registry, genaiClient, mailer, baseURL),
		),
	)

	// Orders endpoint
	mux.Handle(
		"/orders",
		auth.RequireSession(sqlDB)(
			orders.MakeOrdersHandler(sqlDB, logger, registry, mailer),
		),
	)

	// Admin router
	mux.Handle(
		"/admin/",
		auth.RequireSession(sqlDB)(
			admin.MakeAdminRouter(sqlDB, logger),
		),
	)

	// CORS (allows cookie credentials)
	corsHandler := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173"},
		AllowCredentials: true,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type"}, // no more Authorization header
	}).Handler(mux)

	server := &http.Server{
		Addr:         cfg.ServerAddress,
		Handler:      corsHandler,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	logger.Info("starting server", zap.String("addr", cfg.ServerAddress))
	if err := server.ListenAndServe(); err != nil {
		logger.Fatal("server failed", zap.Error(err))
	}
}
