package integration_test

import (
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	repository "github.com/melmut-42/ft_transcendence/backend/auth-service/internal/repository/postgres"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
)

func TestSessionRevocationOutboxRollbackPostgres(t *testing.T) {
	f := newPostgresSession(t)
	repo := repository.NewAuth(f.pool)
	injected := errors.New("abort revocation transaction")
	err := repo.WithSessionTransaction(f.ctx, func(tx service.SessionTx) error {
		if err := tx.RevokeSession(f.ctx, f.original.Credentials.Session.ID, time.Now().UTC()); err != nil {
			return err
		}
		return injected
	})
	if !errors.Is(err, injected) {
		t.Fatalf("rollback error = %v", err)
	}
	assertPendingRevocations(t, f, repo, 0)
	assertSessionFamily(t, f, f.original.Credentials.Session.ID, 1, false)
	assertPostgresAuthorization(t, f, f.original.Credentials, true)
}

func TestSessionRevocationOutboxDeliveryPostgres(t *testing.T) {
	f := newPostgresSession(t)
	repo := repository.NewAuth(f.pool)
	id := f.original.Credentials.Session.ID
	now := time.Now().UTC().Truncate(time.Microsecond)
	err := repo.WithSessionTransaction(f.ctx, func(tx service.SessionTx) error {
		if err := tx.RevokeSession(f.ctx, id, now); err != nil {
			return err
		}
		return tx.RevokeSession(f.ctx, id, now.Add(time.Hour))
	})
	if err != nil {
		t.Fatal(err)
	}
	events := assertPendingRevocations(t, f, repo, 1)
	if events[0].SessionID != id || events[0].UserID != f.original.User.ID || !events[0].RevokedAt.Equal(now) {
		t.Fatalf("outbox changed the session's original revocation: %+v", events)
	}
	if _, err := f.pool.Exec(f.ctx, "DELETE FROM users WHERE id = $1", f.original.User.ID); err != nil {
		t.Fatal(err)
	}
	assertPendingRevocations(t, f, repo, 1)
	assertIdempotentRevocationDelivery(t, f, repo, id)
	assertRevocationRepositoryBounds(t, f, repo)
}

func TestSessionRevocationOutboxInsertFailurePostgres(t *testing.T) {
	f := newPostgresSession(t)
	repo := repository.NewAuth(f.pool)
	_, err := f.pool.Exec(f.ctx, `
		CREATE FUNCTION fail_revocation_enqueue() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN RAISE EXCEPTION 'injected outbox failure'; END; $$;
		CREATE TRIGGER reject_revocation BEFORE INSERT ON session_revocations
		FOR EACH ROW EXECUTE FUNCTION fail_revocation_enqueue()`)
	if err != nil {
		t.Fatal(err)
	}
	err = repo.WithSessionTransaction(f.ctx, func(tx service.SessionTx) error {
		return tx.RevokeSession(f.ctx, f.original.Credentials.Session.ID, time.Now().UTC())
	})
	var pgError *pgconn.PgError
	if !errors.As(err, &pgError) || pgError.Code != "P0001" {
		t.Fatalf("expected injected outbox failure: %v", err)
	}
	assertPendingRevocations(t, f, repo, 0)
	assertSessionFamily(t, f, f.original.Credentials.Session.ID, 1, false)
	assertPostgresAuthorization(t, f, f.original.Credentials, true)
}

func assertPendingRevocations(t *testing.T, f postgresSessionFixture, repo service.RevocationRepository, count int) []service.SessionRevocation {
	t.Helper()
	events, err := repo.PendingSessionRevocations(f.ctx, 100)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != count {
		t.Fatalf("pending outbox events = %d, want %d", len(events), count)
	}
	return events
}

func assertIdempotentRevocationDelivery(t *testing.T, f postgresSessionFixture, repo service.RevocationRepository, id string) {
	t.Helper()
	var first, repeated time.Time
	for _, destination := range []*time.Time{&first, &repeated} {
		if err := repo.MarkSessionRevocationDelivered(f.ctx, id); err != nil {
			t.Fatal(err)
		}
		if err := f.pool.QueryRow(f.ctx, "SELECT delivered_at FROM session_revocations WHERE session_id = $1", id).
			Scan(destination); err != nil {
			t.Fatal(err)
		}
	}
	if !first.Equal(repeated) {
		t.Fatal("repeated delivery changed the original delivery timestamp")
	}
	assertPendingRevocations(t, f, repo, 0)
}

func assertRevocationRepositoryBounds(t *testing.T, f postgresSessionFixture, repo service.RevocationRepository) {
	t.Helper()
	for _, limit := range []int{0, 1001} {
		if _, err := repo.PendingSessionRevocations(f.ctx, limit); err == nil {
			t.Fatalf("unbounded outbox request with limit %d was accepted", limit)
		}
	}
	err := repo.MarkSessionRevocationDelivered(f.ctx, "00000000-0000-4000-8000-000000000000")
	if !errors.Is(err, service.ErrNotFound) {
		t.Fatalf("marking nonexistent event returned %v", err)
	}
	err = repo.ScheduleSessionRevocationRetry(f.ctx, "00000000-0000-4000-8000-000000000000", time.Now())
	if !errors.Is(err, service.ErrNotFound) {
		t.Fatalf("scheduling nonexistent event returned %v", err)
	}
}
