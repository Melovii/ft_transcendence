package config

import (
	"errors"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/melmut-42/ft_transcendence/backend/shared/logging"
)

const defaultPort = "8080"

type Config struct {
	Environment    string
	LogFormat      string
	LogLevel       string
	Port           string
	DatabaseURL    string `json:"-"`
	MigrateOnStart bool
}

// Load reads and validates application settings from the process environment.
//
// It takes no parameters and does not load .env files. Missing optional settings
// use the default port, migration behavior and environment-specific logging settings.
//
// It returns the validated Config, or a zero Config on failure.
//
// Errors:
//
//   - Missing settings: DATABASE_URL was not supplied.
//   - Malformed values: PORT, DATABASE_URL or MIGRATE_ON_START could not be parsed.
//   - Logging settings: APP_ENV, LOG_FORMAT or LOG_LEVEL has an unsupported value.
//   - Invalid bounds: Port is outside the valid TCP range.
func Load() (Config, error) {
	cfg := Config{
		Environment:    strings.TrimSpace(os.Getenv("APP_ENV")),
		LogFormat:      strings.TrimSpace(os.Getenv("LOG_FORMAT")),
		LogLevel:       strings.TrimSpace(os.Getenv("LOG_LEVEL")),
		Port:           strings.TrimSpace(os.Getenv("PORT")),
		DatabaseURL:    strings.TrimSpace(os.Getenv("DATABASE_URL")),
		MigrateOnStart: true,
	}

	if err := cfg.configureLogging(); err != nil {
		return Config{}, err
	}
	if cfg.Port == "" {
		cfg.Port = defaultPort
	}
	if raw := strings.TrimSpace(os.Getenv("MIGRATE_ON_START")); raw != "" {
		value, err := strconv.ParseBool(raw)
		if err != nil {
			return Config{}, errors.New("MIGRATE_ON_START must be true or false")
		}
		cfg.MigrateOnStart = value
	}
	if err := cfg.validate(); err != nil {
		return Config{}, err
	}

	return cfg, nil
}

// configureLogging applies environment defaults and validates logging settings.
func (cfg *Config) configureLogging() error {
	if cfg.Environment == "" {
		cfg.Environment = "development"
	}
	format, level := "text", "debug"
	switch cfg.Environment {
	case "development":
	case "production":
		format, level = "json", "info"
	case "test":
		level = "error"
	default:
		return errors.New("APP_ENV must be development, production or test")
	}
	if cfg.LogFormat == "" {
		cfg.LogFormat = format
	}
	if cfg.LogLevel == "" {
		cfg.LogLevel = level
	}
	if err := (logging.Config{Format: cfg.LogFormat, Level: cfg.LogLevel}).Validate(); err != nil {
		return err
	}

	return nil
}

func (cfg Config) validate() error {
	port, err := strconv.Atoi(cfg.Port)
	if err != nil || port < 1 || port > 65535 {
		return errors.New("PORT must be an integer between 1 and 65535")
	}

	if cfg.DatabaseURL == "" {
		return errors.New("DATABASE_URL is required")
	}
	parsed, err := url.Parse(cfg.DatabaseURL)
	if err != nil || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") || parsed.Host == "" {
		return errors.New("DATABASE_URL must be a postgres:// or postgresql:// URL")
	}

	return nil
}
