package integration_test

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/security"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
)

func TestSessionLoginPostgres(t *testing.T) {
	f := newPostgresSession(t)
	login := postgresSessionLogin(t, f)
	if login.User.ID != f.original.User.ID || login.Credentials.Session.ID == f.original.Credentials.Session.ID {
		t.Fatal("login must create an independent session for the existing account")
	}
	assertSessionTableCounts(t, f, 2, 2)
	assertStoredRefresh(t, f, login.Credentials)
	assertPostgresAuthorization(t, f, f.original.Credentials, true)
	assertPostgresAuthorization(t, f, login.Credentials, true)
}

func TestSessionRefreshReplayPostgres(t *testing.T) {
	f := newPostgresSession(t)
	other := postgresSessionLogin(t, f)
	replacement := postgresSessionRefresh(t, f, f.original.Credentials.RefreshToken)
	assertPostgresRotation(t, f, f.original.Credentials, replacement)
	assertPostgresAuthorization(t, f, f.original.Credentials, true)
	assertPostgresAuthorization(t, f, replacement, true)
	result, err := f.auth.Refresh(f.ctx, f.original.Credentials.RefreshToken)
	if !errors.Is(err, service.ErrSessionExpired) || result.AccessToken != "" {
		t.Fatalf("replayed refresh returned credentials=%+v err=%v", result.Session, err)
	}
	assertSessionFamily(t, f, replacement.Session.ID, 2, true)
	assertPostgresAuthorization(t, f, f.original.Credentials, false)
	assertPostgresAuthorization(t, f, replacement, false)
	assertPostgresAuthorization(t, f, other.Credentials, true)
	assertSessionFamily(t, f, other.Credentials.Session.ID, 1, false)
	assertSessionTableCounts(t, f, 2, 3)
}

func TestSessionConcurrentRefreshPostgres(t *testing.T) {
	f := newPostgresSession(t)
	results := concurrentPostgresRefresh(f)
	replacement := assertConcurrentRefreshResults(t, f, results)
	assertSessionFamily(t, f, f.original.Credentials.Session.ID, 2, true)
	assertPostgresAuthorization(t, f, f.original.Credentials, false)
	assertPostgresAuthorization(t, f, replacement, false)
	assertSessionTableCounts(t, f, 1, 2)
}

func TestSessionRotationRollbackPostgres(t *testing.T) {
	f := newPostgresSession(t)
	installPostgresRotationFailure(t, f)
	credentials, err := f.auth.Refresh(f.ctx, f.original.Credentials.RefreshToken)
	var pgError *pgconn.PgError
	if !errors.As(err, &pgError) || pgError.Code != "P0001" || credentials.RefreshToken != "" {
		t.Fatalf("expected injected rotation failure and no credentials: %v", err)
	}
	assertSessionTableCounts(t, f, 1, 1)
	assertUnconsumedRefresh(t, f, f.original.Credentials.Refresh.ID)
	assertSessionFamily(t, f, f.original.Credentials.Session.ID, 1, false)
	assertPostgresAuthorization(t, f, f.original.Credentials, true)
	if _, err := f.pool.Exec(f.ctx, "DROP TRIGGER reject_rotation ON refresh_tokens"); err != nil {
		t.Fatal(err)
	}
	replacement := postgresSessionRefresh(t, f, f.original.Credentials.RefreshToken)
	assertPostgresRotation(t, f, f.original.Credentials, replacement)
}

func TestSessionLogoutPostgres(t *testing.T) {
	f := newPostgresSession(t)
	other := postgresSessionLogin(t, f)
	replacement := postgresSessionRefresh(t, f, f.original.Credentials.RefreshToken)
	identity, err := f.auth.Authenticate(f.ctx, replacement.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	if err := f.auth.Logout(f.ctx, identity); err != nil {
		t.Fatal(err)
	}
	assertSessionFamily(t, f, replacement.Session.ID, 2, true)
	for _, credentials := range []security.Credentials{f.original.Credentials, replacement} {
		assertPostgresAuthorization(t, f, credentials, false)
		if _, err := f.auth.Refresh(f.ctx, credentials.RefreshToken); !errors.Is(err, service.ErrSessionExpired) {
			t.Fatalf("logged-out refresh error = %v", err)
		}
	}
	assertPostgresAuthorization(t, f, other.Credentials, true)
	assertSessionFamily(t, f, other.Credentials.Session.ID, 1, false)
}
