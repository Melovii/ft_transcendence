package main

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/melmut-42/ft_transcendence/backend/user-service/internal/config"
	"github.com/melmut-42/ft_transcendence/backend/user-service/internal/controller"
	userpostgres "github.com/melmut-42/ft_transcendence/backend/user-service/internal/repository/postgres"
	"github.com/melmut-42/ft_transcendence/backend/user-service/internal/server"
	"github.com/melmut-42/ft_transcendence/backend/user-service/internal/service"
)

// setup initializes application dependencies and creates the HTTP server.
//
// Parameters:
//
//   - ctx: Controls migration and database connection startup.
//   - cfg: Validated application settings.
//   - logger: Configured service logger.
//
// It applies pending migrations when cfg.MigrateOnStart is set, opens the
// schema-scoped connection pool and wires the layers together.
//
// It returns an unstarted server and a cleanup function that closes the pool.
// The caller must invoke cleanup after HTTP shutdown. On failure, both values are nil.
//
// Errors:
//
//   - Migration errors: A migration could not be applied; see repository Migrate.
//   - PostgreSQL errors: Invalid connection settings or failed connectivity checks, including context cancellation and deadlines.
func setup(ctx context.Context, cfg config.Config, logger *slog.Logger) (*http.Server, func(), error) {
	if cfg.MigrateOnStart {
		if err := userpostgres.Migrate(ctx, cfg.DatabaseURL); err != nil {
			return nil, nil, err
		}
		logger.InfoContext(ctx, "database migrations applied")
	}

	pool, err := userpostgres.OpenPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, nil, err
	}

	logger.InfoContext(ctx, "PostgreSQL connection established")

	healthRepository := userpostgres.NewHealth(pool)
	healthService := service.NewHealth(healthRepository)
	healthController := controller.NewHealth(healthService)

	return server.New(cfg.Port, healthController, logger), pool.Close, nil
}
