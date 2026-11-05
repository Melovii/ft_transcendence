package unit_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/model"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/testutil"
)

// sessionOnlyRepository exposes account and session storage without the
// revocation delivery queue, modelling a misconfigured deployment.
type sessionOnlyRepository struct {
	repo *testutil.MemoryRepository
}

func (r sessionOnlyRepository) WithTransaction(ctx context.Context, fn func(service.AuthTx) error) error {
	return r.repo.WithTransaction(ctx, fn)
}

func (r sessionOnlyRepository) FindUserByEmail(ctx context.Context, email string) (model.User, error) {
	return r.repo.FindUserByEmail(ctx, email)
}

func (r sessionOnlyRepository) FindSessionUser(ctx context.Context, id string) (model.User, model.Session, error) {
	return r.repo.FindSessionUser(ctx, id)
}

func (r sessionOnlyRepository) WithSessionTransaction(ctx context.Context, fn func(service.SessionTx) error) error {
	return r.repo.WithSessionTransaction(ctx, fn)
}

// TestRefreshReuseNotificationOutageStillExpires checks that a Gateway outage after a
// committed reuse revocation still answers SESSION_EXPIRED and keeps the notification
// queued for retry.
func TestRefreshReuseNotificationOutageStillExpires(t *testing.T) {
	for _, stage := range []string{"close", "mark_revocation"} {
		t.Run(stage, func(t *testing.T) {
			lifecycle := &lifecycleSpy{}
			auth, repo, registered := registeredSession(t, service.WithSessionLifecycle(lifecycle))
			lifecycle.repo = repo
			replacement, err := auth.Refresh(context.Background(), registered.Credentials.RefreshToken)
			if err != nil {
				t.Fatal(err)
			}
			lifecycle.failure, repo.FailAt = stage, stage

			result, err := auth.Refresh(context.Background(), registered.Credentials.RefreshToken)
			if !errors.Is(err, service.ErrSessionExpired) || result.AccessToken != "" || result.RefreshToken != "" {
				t.Fatalf("reuse during a delivery outage: credentials issued=%t err=%v", result.AccessToken != "", err)
			}
			sessionID := registered.Credentials.Session.ID
			assertRejectedAccess(t, auth, registered.Credentials.AccessToken, replacement.AccessToken)
			if len(repo.Revocations) != 1 || repo.DeliveredRevocations[sessionID] {
				t.Fatal("reuse revocation notification was lost or marked delivered during the outage")
			}
			if _, err := auth.Refresh(context.Background(), replacement.RefreshToken); !errors.Is(err, service.ErrSessionExpired) {
				t.Fatalf("replacement refresh after family revocation: %v", err)
			}

			lifecycle.failure, repo.FailAt = "", ""
			if err := repo.ScheduleSessionRevocationRetry(context.Background(), sessionID, time.Now().Add(-time.Second)); err != nil {
				t.Fatal(err)
			}
			if err := auth.DeliverPendingRevocations(context.Background()); err != nil || !repo.DeliveredRevocations[sessionID] {
				t.Fatalf("queued reuse notification was not retried: %v", err)
			}
		})
	}
}

// TestRefreshReuseWithoutRevocationStorageFails keeps missing revocation storage a
// configuration fault instead of a successful-looking SESSION_EXPIRED.
func TestRefreshReuseWithoutRevocationStorageFails(t *testing.T) {
	lifecycle := &lifecycleSpy{}
	_, repo, registered := registeredSession(t)
	lifecycle.repo = repo
	auth := service.NewAuth(sessionOnlyRepository{repo}, testutil.TokenIssuer(t), service.WithSessionLifecycle(lifecycle))
	if _, err := auth.Refresh(context.Background(), registered.Credentials.RefreshToken); err != nil {
		t.Fatal(err)
	}
	_, err := auth.Refresh(context.Background(), registered.Credentials.RefreshToken)
	if !errors.Is(err, service.ErrSessionUnavailable) || errors.Is(err, service.ErrSessionExpired) {
		t.Fatalf("reuse without revocation storage: %v", err)
	}
}
