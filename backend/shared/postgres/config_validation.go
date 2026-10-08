package postgres

import (
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

func validateConfig(config Config) error {
	if strings.TrimSpace(config.DSN) == "" {
		return fmt.Errorf("%w: DSN is required", ErrInvalidConfig)
	}

	if config.ConnectTimeout < 0 || config.MaxConns < 0 || config.MinConns < 0 ||
		config.MaxConnLifetime < 0 || config.MaxConnIdleTime < 0 {
		return fmt.Errorf("%w: settings must not be negative", ErrInvalidConfig)
	}

	return nil
}

func validatePoolConfig(cfg *pgxpool.Config) error {
	if cfg.MaxConns < 1 || cfg.MinConns < 0 || cfg.MinConns > cfg.MaxConns ||
		cfg.MinIdleConns < 0 || cfg.MinIdleConns > cfg.MaxConns {
		return fmt.Errorf("%w: minimum connections must be between zero and maximum connections", ErrInvalidConfig)
	}

	if cfg.MaxConnLifetime <= 0 || cfg.MaxConnIdleTime <= 0 || cfg.HealthCheckPeriod <= 0 {
		return fmt.Errorf("%w: pool lifetime, idle time and health check period must be positive", ErrInvalidConfig)
	}

	if cfg.MaxConnLifetimeJitter < 0 || cfg.PingTimeout < 0 {
		return fmt.Errorf("%w: pool jitter and ping timeout must not be negative", ErrInvalidConfig)
	}

	return nil
}
