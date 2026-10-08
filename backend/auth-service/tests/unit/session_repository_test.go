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

func TestSessionTransactionRollbackRetainsOriginalRecords(t *testing.T) {
	for _, stage := range []string{"revoke", "outbox", "commit"} {
		t.Run(stage, func(t *testing.T) {
			repo := seedSessionRepository(t)
			repo.FailAt = stage
			if stage == "commit" {
				repo.CommitErr = errors.New("commit failure")
			}
			err := repo.WithSessionTransaction(context.Background(), consumeAndRevoke)
			if err == nil {
				t.Fatal("expected transaction failure")
			}
			if len(repo.Refresh) != 1 || repo.Refresh[0].RevokedAt != nil {
				t.Fatalf("refresh writes survived rollback: %+v", repo.Refresh)
			}
			if repo.Sessions[0].RevokedAt != nil {
				t.Fatal("session revocation survived rollback")
			}
			if len(repo.Revocations) != 0 {
				t.Fatal("outbox events survived rollback")
			}
		})
	}
}

func consumeAndRevoke(tx service.SessionTx) error {
	ctx := context.Background()
	now := time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC)
	if err := tx.CreateRefreshToken(ctx, model.RefreshToken{ID: "replacement", SessionID: "session"}); err != nil {
		return err
	}
	if err := tx.RotateRefreshToken(ctx, "refresh", "replacement", now); err != nil {
		return err
	}
	return tx.RevokeSession(ctx, "session", now)
}

func TestSessionRevocationPreservesEarlierTimestamps(t *testing.T) {
	repo := seedSessionRepository(t)
	ctx := context.Background()
	first := time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC)
	err := repo.WithSessionTransaction(ctx, func(tx service.SessionTx) error {
		if err := tx.RevokeSession(ctx, "session", first); err != nil {
			return err
		}
		return tx.RevokeSession(ctx, "session", first.Add(time.Hour))
	})
	if err != nil {
		t.Fatal(err)
	}
	if !repo.Sessions[0].RevokedAt.Equal(first) || !repo.Refresh[0].RevokedAt.Equal(first) {
		t.Fatal("repeated revocation changed the original timestamp")
	}
}

func TestSessionRepositoryLookupAndMissingRecords(t *testing.T) {
	repo := seedSessionRepository(t)
	ctx := context.Background()
	user, err := repo.FindUserByEmail(ctx, "ACCOUNT@EXAMPLE.COM")
	if err != nil || user.ID != 1 {
		t.Fatalf("case-insensitive lookup failed: user=%+v err=%v", user, err)
	}
	_, session, err := repo.FindSessionUser(ctx, "session")
	if err != nil || session.UserID != user.ID {
		t.Fatalf("session association lookup failed: session=%+v err=%v", session, err)
	}
	_, _, err = repo.FindSessionUser(ctx, "missing")
	if !errors.Is(err, service.ErrNotFound) {
		t.Fatalf("missing session error = %v", err)
	}
}

func seedSessionRepository(t *testing.T) *testutil.MemoryRepository {
	t.Helper()
	repo := &testutil.MemoryRepository{}
	ctx := context.Background()
	err := repo.WithTransaction(ctx, func(tx service.AuthTx) error {
		user, err := tx.CreateUser(ctx, model.User{Email: "account@example.com", Username: "account"})
		if err != nil {
			return err
		}
		if err := tx.CreateSession(ctx, model.Session{ID: "session", UserID: user.ID}); err != nil {
			return err
		}
		return tx.CreateRefreshToken(ctx, model.RefreshToken{ID: "refresh", SessionID: "session", TokenHash: "hash"})
	})
	if err != nil {
		t.Fatal(err)
	}
	return repo
}
