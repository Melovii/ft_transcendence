package main

import (
	"context"
	"log/slog"
	"time"

	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
)

func startSessionRevocations(ctx context.Context, auth *service.AuthService, closePool func(), logger *slog.Logger) func() {
	workerCtx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() {
		defer close(done)
		retrySessionRevocations(workerCtx, auth, logger)
	}()
	return func() {
		cancel()
		<-done
		closePool()
	}
}

func retrySessionRevocations(ctx context.Context, auth *service.AuthService, logger *slog.Logger) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		if err := deliverSessionRevocationBatch(ctx, auth); err != nil && ctx.Err() == nil {
			logger.ErrorContext(ctx, "session_revocation_delivery_failed", "error", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func deliverSessionRevocationBatch(ctx context.Context, auth *service.AuthService) error {
	batchCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	return auth.DeliverPendingRevocations(batchCtx)
}
