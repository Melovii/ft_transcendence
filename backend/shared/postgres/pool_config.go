package postgres

import (
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PoolConfig prepares validated pgx settings without opening a connection.
//
// Parameters:
//
//   - config: Connection string and explicit pool overrides.
//
// It returns parsed settings with defaults and overrides applied, or nil on failure.
// Errors omit the DSN and raw driver details.
//
// Errors:
//
//   - ErrInvalidConfig: The DSN is missing or malformed, an option is negative, or effective pool bounds are inconsistent.
func PoolConfig(config Config) (*pgxpool.Config, error) {
	if err := validateConfig(config); err != nil {
		return nil, err
	}

	cfg, err := pgxpool.ParseConfig(config.DSN)
	if err != nil {
		// Raw pgx errors may include credentials from the connection string.
		return nil, fmt.Errorf("%w: malformed connection string", ErrInvalidConfig)
	}

	applyOverrides(cfg, config)

	if err := validatePoolConfig(cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}

func applyOverrides(cfg *pgxpool.Config, config Config) {
	cfg.ConnConfig.ConnectTimeout = config.ConnectTimeout
	if cfg.ConnConfig.ConnectTimeout == 0 {
		cfg.ConnConfig.ConnectTimeout = defaultConnectTimeout
	}

	if config.MaxConns > 0 {
		cfg.MaxConns = config.MaxConns
	}

	if config.MinConns > 0 {
		cfg.MinConns = config.MinConns
	}

	if config.MaxConnLifetime > 0 {
		cfg.MaxConnLifetime = config.MaxConnLifetime
	}

	if config.MaxConnIdleTime > 0 {
		cfg.MaxConnIdleTime = config.MaxConnIdleTime
	}
}
