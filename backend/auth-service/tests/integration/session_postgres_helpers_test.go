package integration_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/model"
	repository "github.com/melmut-42/ft_transcendence/backend/auth-service/internal/repository/postgres"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/security"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/testutil"
)

type postgresSessionFixture struct {
	ctx      context.Context
	pool     *pgxpool.Pool
	auth     *service.AuthService
	original service.AuthResult
}

func newPostgresSession(t *testing.T) postgresSessionFixture {
	t.Helper()
	pool := registrationTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	t.Cleanup(cancel)
	auth := service.NewAuth(repository.NewAuth(pool), testutil.TokenIssuer(t))
	original, err := auth.Register(ctx, testutil.ValidInput())
	if err != nil {
		t.Fatal(err)
	}
	return postgresSessionFixture{ctx: ctx, pool: pool, auth: auth, original: original}
}

func postgresSessionLogin(t *testing.T, f postgresSessionFixture) service.AuthResult {
	t.Helper()
	input := testutil.ValidInput()
	result, err := f.auth.Login(f.ctx, service.LoginInput{
		Email: "  " + strings.ToUpper(input.Email) + "  ", Password: input.Password,
	})
	if err != nil {
		t.Fatal(err)
	}
	return result
}

func postgresSessionRefresh(t *testing.T, f postgresSessionFixture, raw string) security.Credentials {
	t.Helper()
	credentials, err := f.auth.Refresh(f.ctx, raw)
	if err != nil {
		t.Fatal(err)
	}
	return credentials
}

func assertSessionTableCounts(t *testing.T, f postgresSessionFixture, sessions, refresh int) {
	t.Helper()
	var userCount, sessionCount, refreshCount int
	err := f.pool.QueryRow(f.ctx, `SELECT (SELECT count(*) FROM users),
		(SELECT count(*) FROM sessions), (SELECT count(*) FROM refresh_tokens)`).
		Scan(&userCount, &sessionCount, &refreshCount)
	if err != nil {
		t.Fatal(err)
	}
	if userCount != 1 || sessionCount != sessions || refreshCount != refresh {
		t.Fatalf("row counts=%d/%d/%d, want 1/%d/%d", userCount, sessionCount, refreshCount, sessions, refresh)
	}
}

func assertStoredRefresh(t *testing.T, f postgresSessionFixture, credentials security.Credentials) {
	t.Helper()
	var hash, sessionID string
	err := f.pool.QueryRow(f.ctx, `SELECT token_hash, session_id::text
		FROM refresh_tokens WHERE id = $1`, credentials.Refresh.ID).Scan(&hash, &sessionID)
	if err != nil {
		t.Fatal(err)
	}
	expected := sha256.Sum256([]byte(credentials.RefreshToken))
	if hash != hex.EncodeToString(expected[:]) || hash == credentials.RefreshToken {
		t.Fatal("refresh persistence must contain the credential hash")
	}
	if sessionID != credentials.Session.ID {
		t.Fatal("refresh credential changed its session family")
	}
}

func assertPostgresRotation(t *testing.T, f postgresSessionFixture, previous, replacement security.Credentials) {
	t.Helper()
	var token model.RefreshToken
	err := f.pool.QueryRow(f.ctx, `SELECT rotated_at, replaced_by::text, revoked_at
		FROM refresh_tokens WHERE id = $1`, previous.Refresh.ID).
		Scan(&token.RotatedAt, &token.ReplacedBy, &token.RevokedAt)
	if err != nil {
		t.Fatal(err)
	}
	if token.RotatedAt == nil || token.RevokedAt == nil || token.ReplacedBy == nil {
		t.Fatal("rotation must retain the consumed token and its replacement link")
	}
	if *token.ReplacedBy != replacement.Refresh.ID || !token.RotatedAt.Equal(*token.RevokedAt) {
		t.Fatal("rotation stored the wrong replacement or consumption timestamp")
	}
	if previous.RefreshToken == replacement.RefreshToken || previous.Session.ID != replacement.Session.ID {
		t.Fatal("rotation must change the secret and preserve the session")
	}
	assertStoredRefresh(t, f, previous)
	assertStoredRefresh(t, f, replacement)
}

func assertSessionFamily(t *testing.T, f postgresSessionFixture, id string, expected int, revoked bool) {
	t.Helper()
	var sessionRevoked bool
	err := f.pool.QueryRow(f.ctx, `SELECT revoked_at IS NOT NULL FROM sessions WHERE id = $1`, id).
		Scan(&sessionRevoked)
	if err != nil {
		t.Fatal(err)
	}
	var total, revokedCount int
	err = f.pool.QueryRow(f.ctx, `SELECT count(*), count(*) FILTER (WHERE revoked_at IS NOT NULL)
		FROM refresh_tokens WHERE session_id = $1`, id).Scan(&total, &revokedCount)
	if err != nil {
		t.Fatal(err)
	}
	expectedRevoked := 0
	if revoked {
		expectedRevoked = expected
	}
	if total != expected || sessionRevoked != revoked || revokedCount != expectedRevoked {
		t.Fatalf("family state: session revoked=%v, tokens=%d/%d, want revoked=%v, tokens=%d/%d",
			sessionRevoked, total, revokedCount, revoked, expected, expectedRevoked)
	}
}

func assertPostgresAuthorization(t *testing.T, f postgresSessionFixture, credentials security.Credentials, active bool) {
	t.Helper()
	identity, err := f.auth.Authenticate(f.ctx, credentials.AccessToken)
	if !active {
		if !errors.Is(err, service.ErrUnauthorized) {
			t.Fatalf("revoked session authorization error = %v", err)
		}
		return
	}
	if err != nil || identity.User.ID != f.original.User.ID || identity.SessionID != credentials.Session.ID {
		t.Fatalf("active session authorization failed: identity=%+v err=%v", identity, err)
	}
}

func installPostgresRotationFailure(t *testing.T, f postgresSessionFixture) {
	t.Helper()
	_, err := f.pool.Exec(f.ctx, `
		CREATE FUNCTION fail_refresh_rotation() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN RAISE EXCEPTION 'injected rotation failure'; END; $$;
		CREATE TRIGGER reject_rotation BEFORE UPDATE ON refresh_tokens
		FOR EACH ROW EXECUTE FUNCTION fail_refresh_rotation()`)
	if err != nil {
		t.Fatal(err)
	}
}

func assertUnconsumedRefresh(t *testing.T, f postgresSessionFixture, id string) {
	t.Helper()
	var unused bool
	err := f.pool.QueryRow(f.ctx, `SELECT rotated_at IS NULL AND replaced_by IS NULL AND revoked_at IS NULL
		FROM refresh_tokens WHERE id = $1`, id).Scan(&unused)
	if err != nil {
		t.Fatal(err)
	}
	if !unused {
		t.Fatal("failed rotation consumed its original refresh credential")
	}
}
