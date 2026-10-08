package main

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/config"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/controller"
	authpostgres "github.com/melmut-42/ft_transcendence/backend/auth-service/internal/repository/postgres"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/security"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/server"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
	"github.com/melmut-42/ft_transcendence/backend/shared/postgres"
)

// setup initializes application dependencies and creates the HTTP server.
//
// Parameters:
//
//   - ctx: Controls database connection startup.
//   - cfg: Validated application settings.
//   - logger: Configured service logger.
//
// It returns an unstarted server and a cleanup function that closes the pool.
// The caller must invoke cleanup after HTTP shutdown. On failure, both values are nil.
//
// Errors:
//
//   - Token issuer errors: Invalid signing key or credential lifetimes.
//   - PostgreSQL errors: Invalid connection settings or failed connectivity checks, including context cancellation and deadlines.
func setup(ctx context.Context, cfg config.Config, logger *slog.Logger) (*http.Server, func(), error) {
	issuer, err := security.NewTokenIssuer([]byte(cfg.JWTSecret), cfg.AccessTokenTTL, cfg.RefreshTokenTTL)
	if err != nil {
		return nil, nil, err
	}

	pool, err := postgres.Open(ctx, postgres.Config{DSN: cfg.DatabaseURL})
	if err != nil {
		return nil, nil, err
	}

	logger.InfoContext(ctx, "PostgreSQL connection established")

	authRepository := authpostgres.NewAuth(pool)
	authService := service.NewAuth(authRepository, issuer)
	authController := controller.NewAuth(authService)
	cleanup := startSessionRevocations(ctx, authService, pool.Close, logger)

	return server.New(cfg.Port, authController, logger), cleanup, nil
}
