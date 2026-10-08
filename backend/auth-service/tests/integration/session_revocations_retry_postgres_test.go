package integration_test

import (
	"testing"
	"time"

	repository "github.com/melmut-42/ft_transcendence/backend/auth-service/internal/repository/postgres"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
)

func TestSessionRevocationRetryPostgres(t *testing.T) {
	f := newPostgresSession(t)
	repo := repository.NewAuth(f.pool)
	other := postgresSessionLogin(t, f)
	id := f.original.Credentials.Session.ID
	now := time.Now().UTC().Truncate(time.Microsecond)
	revokePostgresTestSession(t, f, repo, id, now)
	if err := repo.ScheduleSessionRevocationRetry(f.ctx, id, now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	revokePostgresTestSession(t, f, repo, other.Credentials.Session.ID, now)
	events := assertPendingRevocations(t, f, repo, 1)
	if events[0].SessionID != other.Credentials.Session.ID {
		t.Fatal("a delayed failure blocked a fresh revocation")
	}
	past := now.Add(-time.Hour)
	if err := repo.ScheduleSessionRevocationRetry(f.ctx, id, past); err != nil {
		t.Fatal(err)
	}
	events = assertPendingRevocations(t, f, repo, 2)
	if events[0].SessionID != id || !events[0].NextAttemptAt.Equal(past) {
		t.Fatal("due retry was not restored at its scheduled position")
	}
	assertDeliveredRetryUnchanged(t, f, repo, id, past)
}

func revokePostgresTestSession(t *testing.T, f postgresSessionFixture, repo service.SessionRepository, id string, now time.Time) {
	t.Helper()
	err := repo.WithSessionTransaction(f.ctx, func(tx service.SessionTx) error {
		return tx.RevokeSession(f.ctx, id, now)
	})
	if err != nil {
		t.Fatal(err)
	}
}

func assertDeliveredRetryUnchanged(t *testing.T, f postgresSessionFixture, repo service.RevocationRepository, id string, expected time.Time) {
	t.Helper()
	if err := repo.MarkSessionRevocationDelivered(f.ctx, id); err != nil {
		t.Fatal(err)
	}
	if err := repo.ScheduleSessionRevocationRetry(f.ctx, id, expected.Add(2*time.Hour)); err != nil {
		t.Fatal(err)
	}
	var next time.Time
	err := f.pool.QueryRow(f.ctx, "SELECT next_attempt_at FROM session_revocations WHERE session_id = $1", id).Scan(&next)
	if err != nil {
		t.Fatal(err)
	}
	if !next.Equal(expected) {
		t.Fatal("retry scheduling changed an already delivered event")
	}
	assertPendingRevocations(t, f, repo, 1)
}
