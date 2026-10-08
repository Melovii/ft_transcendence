package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Open creates a PostgreSQL pool and verifies connectivity with a ping.
//
// Parameters:
//
//   - ctx: Controls startup; its deadline or Config.ConnectTimeout, whichever is earlier, bounds the connection check.
//   - config: Connection string, timeout and pool settings.
//
// It returns a ready pool owned by the caller, who must close it after use.
// On failure, it closes any created pool and returns nil. Errors omit raw driver
// details and connection strings; use errors.Is to identify wrapped errors.
//
// Errors:
//
//   - ErrInvalidConfig: The DSN or pool settings are malformed or inconsistent.
//   - ErrConnect: Pool creation or connectivity verification failed.
//   - context.Canceled: Startup was canceled; the error also wraps ErrConnect.
//   - context.DeadlineExceeded: Startup timed out; the error also wraps ErrConnect.
func Open(ctx context.Context, config Config) (*pgxpool.Pool, error) {
	cfg, err := PoolConfig(config)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(ctx, cfg.ConnConfig.ConnectTimeout)
	defer cancel()

	if err := ctx.Err(); err != nil {
		return nil, connectionError(ctx, err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, connectionError(ctx, err)
	}

	if err := pool.Ping(ctx); err != nil {
		connectErr := connectionError(ctx, err)
		pool.Close()

		return nil, connectErr
	}

	return pool, nil
}
