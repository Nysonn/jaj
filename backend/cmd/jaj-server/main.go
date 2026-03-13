package main

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
	"go.uber.org/zap"

	"server/internal/admin"
	"server/internal/auth"
	"server/internal/chat"
	"server/internal/config"
	"server/internal/db"
	"server/internal/email"
	"server/internal/monitoring"
	"server/internal/orders"
)

func buildAllowedOrigins() []string {
	defaults := []string{
		"http://localhost:5173",
		"http://127.0.0.1:5173",
		"http://localhost:4173",
		"http://127.0.0.1:4173",
		"https://jaj-delivery.web.app",
		"https://jaj-delivery.firebaseapp.com",
	}

	extra := os.Getenv("FRONTEND_ORIGINS")
	if strings.TrimSpace(extra) == "" {
		return defaults
	}

	origins := make([]string, 0, len(defaults)+4)
	origins = append(origins, defaults...)
	for _, origin := range strings.Split(extra, ",") {
		origin = strings.TrimSpace(origin)
		if origin != "" {
			origins = append(origins, origin)
		}
	}

	return origins
}

func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config load: %v", err)
	}

	groqAPIKey := os.Getenv("GROQ_API_KEY")
	if groqAPIKey == "" {
		log.Fatal("GROQ_API_KEY must be set")
	}

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
			chat.MakePromptHandler(sqlDB, logger, registry, groqAPIKey, mailer, baseURL),
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
	allowedOrigins := buildAllowedOrigins()
	corsHandler := cors.New(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowCredentials: true,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"},
		ExposedHeaders:   []string{"Content-Length", "Content-Type"},
		MaxAge:           300, // Maximum value not ignored by any of major browsers
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
