package config

import (
	"fmt"
	"os"
)

// Config holds settings pulled from environment variables.
type Config struct {
	DatabaseURL   string // e.g. "postgresql://user:pass@host:5432/dbname"
	ServerAddress string // e.g. ":8080"
	SMTPHost      string // e.g. "smtp.mailserver.com:587"
	SMTPUser      string // SMTP username
	SMTPPass      string // SMTP password
	JWTSecret     string
}

// Load reads environment variables and returns a Config.
func Load() (*Config, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	addr := os.Getenv("SERVER_ADDRESS")
	if addr == "" {
		addr = ":8080"
	}

	smtpHost := os.Getenv("SMTP_HOST")
	if smtpHost == "" {
		return nil, fmt.Errorf("SMTP_HOST is required")
	}
	smtpUser := os.Getenv("SMTP_USER")
	if smtpUser == "" {
		return nil, fmt.Errorf("SMTP_USER is required")
	}
	smtpPass := os.Getenv("SMTP_PASS")
	if smtpPass == "" {
		return nil, fmt.Errorf("SMTP_PASS is required")
	}

	return &Config{
		DatabaseURL:   dbURL,
		ServerAddress: addr,
		SMTPHost:      smtpHost,
		SMTPUser:      smtpUser,
		SMTPPass:      smtpPass,
	}, nil
}
