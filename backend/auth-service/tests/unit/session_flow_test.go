package unit_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/security"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/testutil"
)

func registeredSession(t *testing.T, options ...service.Option) (*service.AuthService, *testutil.MemoryRepository, service.AuthResult) {
	t.Helper()
	repo := &testutil.MemoryRepository{}
	auth := service.NewAuth(repo, testutil.TokenIssuer(t), options...)
	result, err := auth.Register(context.Background(), testutil.ValidInput())
	if err != nil {
		t.Fatal(err)
	}
	return auth, repo, result
}

func TestLoginIndependentSessions(t *testing.T) {
	auth, repo, registered := registeredSession(t)
	result, err := auth.Login(context.Background(), service.LoginInput{
		Email: "  " + strings.ToUpper(registered.User.Email) + "  ", Password: testutil.ValidInput().Password,
	})
	if err != nil || result.User.ID != registered.User.ID || len(repo.Sessions) != 2 || len(repo.Refresh) != 2 {
		t.Fatalf("login did not create an independent session: %v", err)
	}
	if result.Credentials.Session.ID == registered.Credentials.Session.ID {
		t.Fatal("login reused the registration session")
	}
	for _, raw := range []string{registered.Credentials.AccessToken, result.Credentials.AccessToken} {
		if _, err := auth.Authenticate(context.Background(), raw); err != nil {
			t.Fatalf("login invalidated a concurrent session: %v", err)
		}
	}
}

func TestLoginRejectedCredentials(t *testing.T) {
	auth, repo, registered := registeredSession(t)
	for _, input := range []service.LoginInput{
		{Email: "unknown@example.com", Password: testutil.ValidInput().Password},
		{Email: registered.User.Email, Password: "wrong"},
		{Email: registered.User.Email, Password: strings.Repeat("a", 73)},
		{Email: "bad", Password: testutil.ValidInput().Password},
	} {
		result, err := auth.Login(context.Background(), input)
		if !errors.Is(err, service.ErrInvalidCredentials) || result.User.ID != 0 || result.Credentials.AccessToken != "" {
			t.Fatalf("invalid credentials returned usable result: %v", err)
		}
	}
	if len(repo.Sessions) != 1 || len(repo.Refresh) != 1 {
		t.Fatal("rejected login persisted credentials")
	}
}

func TestLoginRollback(t *testing.T) {
	for _, stage := range []string{"session", "refresh", "commit", "find_user"} {
		t.Run(stage, func(t *testing.T) {
			auth, repo, registered := registeredSession(t)
			if stage == "commit" {
				repo.CommitErr = errors.New("private commit error")
			} else {
				repo.FailAt = stage
			}
			result, err := auth.Login(context.Background(), service.LoginInput{Email: registered.User.Email, Password: testutil.ValidInput().Password})
			if err == nil || result.User.ID != 0 || result.Credentials.AccessToken != "" {
				t.Fatal("failed login returned credentials")
			}
			if len(repo.Sessions) != 1 || len(repo.Refresh) != 1 {
				t.Fatal("failed login left partial session writes")
			}
		})
	}
}

func TestRefreshReuseRevokesOnlyFamily(t *testing.T) {
	auth, repo, registered := registeredSession(t)
	login, err := auth.Login(context.Background(), service.LoginInput{Email: registered.User.Email, Password: testutil.ValidInput().Password})
	if err != nil {
		t.Fatal(err)
	}
	rotated, err := auth.Refresh(context.Background(), registered.Credentials.RefreshToken)
	if err != nil || rotated.Session.ID != registered.Credentials.Session.ID || len(repo.Sessions) != 2 {
		t.Fatalf("rotation changed session family: %v", err)
	}
	assertConsumedRefresh(t, repo, registered.Credentials.Refresh.ID, rotated.Refresh.ID)
	if _, err := auth.Refresh(context.Background(), registered.Credentials.RefreshToken); !errors.Is(err, service.ErrSessionExpired) {
		t.Fatalf("replayed token: %v", err)
	}
	assertRejectedAccess(t, auth, registered.Credentials.AccessToken, rotated.AccessToken)
	if _, err := auth.Authenticate(context.Background(), login.Credentials.AccessToken); err != nil {
		t.Fatalf("reuse revoked a different login: %v", err)
	}
	if _, err := auth.Refresh(context.Background(), rotated.RefreshToken); !errors.Is(err, service.ErrSessionExpired) {
		t.Fatalf("reuse left descendant refresh usable: %v", err)
	}
}

func assertConsumedRefresh(t *testing.T, repo *testutil.MemoryRepository, oldID, nextID string) {
	t.Helper()
	for _, token := range repo.Refresh {
		if token.ID == oldID {
			if token.RotatedAt == nil || token.RevokedAt == nil || token.ReplacedBy == nil || *token.ReplacedBy != nextID {
				t.Fatal("old token was not atomically consumed and linked")
			}
			return
		}
	}
	t.Fatal("old token disappeared, preventing reuse detection")
}

func assertRejectedAccess(t *testing.T, auth *service.AuthService, tokens ...string) {
	t.Helper()
	for _, raw := range tokens {
		if identity, err := auth.Authenticate(context.Background(), raw); !errors.Is(err, service.ErrUnauthorized) || identity.User.ID != 0 {
			t.Fatalf("revoked credential remains usable: %v", err)
		}
	}
}

func TestRefreshRollback(t *testing.T) {
	for _, stage := range []string{"refresh", "rotate", "commit", "find_refresh"} {
		t.Run(stage, func(t *testing.T) {
			auth, repo, registered := registeredSession(t)
			if stage == "commit" {
				repo.CommitErr = errors.New("private commit error")
			} else {
				repo.FailAt = stage
			}
			result, err := auth.Refresh(context.Background(), registered.Credentials.RefreshToken)
			if err == nil || result.AccessToken != "" || result.RefreshToken != "" {
				t.Fatal("failed refresh returned credentials")
			}
			if len(repo.Refresh) != 1 || repo.Refresh[0].RotatedAt != nil || repo.Refresh[0].RevokedAt != nil {
				t.Fatal("failed refresh consumed its predecessor")
			}
			repo.FailAt, repo.CommitErr = "", nil
			if _, err := auth.Refresh(context.Background(), registered.Credentials.RefreshToken); err != nil {
				t.Fatalf("rollback did not retain usable predecessor: %v", err)
			}
		})
	}
}

func TestRefreshExpiryAndMissing(t *testing.T) {
	auth, repo, registered := registeredSession(t)
	repo.Refresh[0].ExpiresAt = time.Now().Add(-time.Second)
	for _, raw := range []string{"", strings.Repeat("x", 43), registered.Credentials.RefreshToken} {
		result, err := auth.Refresh(context.Background(), raw)
		if !errors.Is(err, service.ErrSessionExpired) || result.AccessToken != "" {
			t.Fatalf("invalid refresh accepted: %v", err)
		}
	}
	if repo.Sessions[0].RevokedAt != nil || repo.Refresh[0].RotatedAt != nil || len(repo.Refresh) != 1 {
		t.Fatal("invalid or expired refresh changed family state")
	}
}

func TestAuthenticateOwnerAndRepositoryErrors(t *testing.T) {
	auth, repo, registered := registeredSession(t)
	repo.Sessions[0].UserID = registered.User.ID + 1
	assertRejectedAccess(t, auth, registered.Credentials.AccessToken)
	repo.Sessions[0].UserID = registered.User.ID
	repo.FailAt = "find_session"
	if _, err := auth.Authenticate(context.Background(), registered.Credentials.AccessToken); err == nil || errors.Is(err, service.ErrUnauthorized) {
		t.Fatal("repository outage was reported as invalid credentials")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := auth.Login(ctx, service.LoginInput{Email: registered.User.Email, Password: testutil.ValidInput().Password}); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled login: %v", err)
	}
}

type unavailableTokens struct{ *security.TokenIssuer }

func (unavailableTokens) Rotate(int64, string) (security.Credentials, error) {
	return security.Credentials{}, errors.New("private issuer failure")
}

func TestRefreshIssuerFailure(t *testing.T) {
	_, repo, registered := registeredSession(t)
	auth := service.NewAuth(repo, unavailableTokens{testutil.TokenIssuer(t)})
	result, err := auth.Refresh(context.Background(), registered.Credentials.RefreshToken)
	if err == nil || result.AccessToken != "" || len(repo.Refresh) != 1 || repo.Refresh[0].RotatedAt != nil {
		t.Fatal("issuer failure consumed refresh token or exposed credentials")
	}
}
