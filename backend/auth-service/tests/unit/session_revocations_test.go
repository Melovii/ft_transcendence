package unit_test

import (
	"context"
	"testing"
	"time"

	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
)

func TestMemoryRevocationRetryEligibility(t *testing.T) {
	repo := seedSessionRepository(t)
	ctx := context.Background()
	now := time.Now().UTC()
	err := repo.WithSessionTransaction(ctx, func(tx service.SessionTx) error {
		return tx.RevokeSession(ctx, "session", now)
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, future := range []bool{true, false} {
		next, expected := now.Add(-time.Hour), 1
		if future {
			next, expected = now.Add(time.Hour), 0
		}
		if err := repo.ScheduleSessionRevocationRetry(ctx, "session", next); err != nil {
			t.Fatal(err)
		}
		events, err := repo.PendingSessionRevocations(ctx, 100)
		if err != nil || len(events) != expected {
			t.Fatalf("retry eligibility: %d events, want %d; err=%v", len(events), expected, err)
		}
	}
}
