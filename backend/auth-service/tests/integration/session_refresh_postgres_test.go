package integration_test

import (
	"errors"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	repository "github.com/melmut-42/ft_transcendence/backend/auth-service/internal/repository/postgres"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/security"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/testutil"
)

// TestSessionRefreshLogoutRacePostgres runs refresh and logout of the same session
// concurrently. Whichever commits first, the session ends revoked and no refresh
// credential of that family stays usable.
func TestSessionRefreshLogoutRacePostgres(t *testing.T) {
	f := newPostgresSession(t)
	for range 8 {
		login := postgresSessionLogin(t, f)
		identity, err := f.auth.Authenticate(f.ctx, login.Credentials.AccessToken)
		if err != nil {
			t.Fatal(err)
		}
		start := make(chan struct{})
		refreshed := make(chan postgresRefreshResult, 1)
		loggedOut := make(chan error, 1)
		go func() {
			<-start
			credentials, err := f.auth.Refresh(f.ctx, login.Credentials.RefreshToken)
			refreshed <- postgresRefreshResult{credentials: credentials, err: err}
		}()
		go func() {
			<-start
			loggedOut <- f.auth.Logout(f.ctx, identity)
		}()
		close(start)

		if err := <-loggedOut; err != nil {
			t.Fatalf("logout during refresh: %v", err)
		}
		result := <-refreshed
		if result.err != nil && !errors.Is(result.err, service.ErrSessionExpired) {
			t.Fatalf("refresh during logout: %v", result.err)
		}
		assertFamilyFullyRevoked(t, f, login.Credentials.Session.ID)
		for _, credentials := range []security.Credentials{login.Credentials, result.credentials} {
			if credentials.RefreshToken == "" {
				continue
			}
			assertPostgresAuthorization(t, f, credentials, false)
			if _, err := f.auth.Refresh(f.ctx, credentials.RefreshToken); !errors.Is(err, service.ErrSessionExpired) {
				t.Fatalf("refresh after the race restored a revoked family: %v", err)
			}
		}
	}
	assertPostgresAuthorization(t, f, f.original.Credentials, true)
}

// TestSessionRefreshSurvivesRestartPostgres closes the original pool and service,
// then continues with a fresh instance over the same schema. Rotation state and
// reuse detection come only from PostgreSQL.
func TestSessionRefreshSurvivesRestartPostgres(t *testing.T) {
	f := newPostgresSession(t)
	replacement := postgresSessionRefresh(t, f, f.original.Credentials.RefreshToken)
	restarted := restartPostgresSession(t, f)

	assertPostgresAuthorization(t, restarted, replacement, true)
	next := postgresSessionRefresh(t, restarted, replacement.RefreshToken)
	assertPostgresRotation(t, restarted, replacement, next)
	if _, err := restarted.auth.Refresh(restarted.ctx, f.original.Credentials.RefreshToken); !errors.Is(err, service.ErrSessionExpired) {
		t.Fatalf("reuse after restart: %v", err)
	}
	assertFamilyFullyRevoked(t, restarted, f.original.Credentials.Session.ID)
	assertPostgresAuthorization(t, restarted, next, false)
}

// TestRefreshCookieRotationHTTPS exercises the real cookie jar over TLS against
// PostgreSQL: Secure cookies travel only over HTTPS, ft_refresh only to its path,
// rotation replaces the stored cookie, and reuse revokes the family.
func TestRefreshCookieRotationHTTPS(t *testing.T) {
	f := newPostgresSession(t)
	server := httptest.NewTLSServer(authHandler(t, repository.NewAuth(f.pool), testutil.TokenIssuer(t)))
	t.Cleanup(server.Close)
	client := server.Client()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	client.Jar = jar
	base := mustURL(t, server.URL)

	input := testutil.ValidInput()
	input.Email, input.Username = "https.player@example.com", "https_player"
	register := sendHTTPS(t, client, http.MethodPost, base, "/api/v1/auth/register", inputJSON(t, input))
	assertSecureCredentialCookies(t, register)
	assertHTTPSStatus(t, register, http.StatusCreated)
	assertJarScoping(t, jar, base)
	initial := jarCookie(t, jar, base, "/api/v1/auth/refresh", "ft_refresh")

	assertHTTPSStatus(t, sendHTTPS(t, client, http.MethodGet, base, "/api/v1/auth/session", ""), http.StatusOK)
	refreshed := sendHTTPS(t, client, http.MethodPost, base, "/api/v1/auth/refresh", "")
	assertSecureCredentialCookies(t, refreshed)
	assertHTTPSStatus(t, refreshed, http.StatusOK)
	rotated := jarCookie(t, jar, base, "/api/v1/auth/refresh", "ft_refresh")
	if rotated == initial {
		t.Fatal("refresh over HTTPS did not replace the stored ft_refresh cookie")
	}
	assertHTTPSStatus(t, sendHTTPS(t, client, http.MethodGet, base, "/api/v1/auth/session", ""), http.StatusOK)

	replay, err := http.NewRequest(http.MethodPost, server.URL+"/api/v1/auth/refresh", nil)
	if err != nil {
		t.Fatal(err)
	}
	replay.AddCookie(&http.Cookie{Name: "ft_refresh", Value: initial})
	bare := server.Client()
	response, err := bare.Do(replay)
	if err != nil {
		t.Fatal(err)
	}
	assertHTTPSError(t, response, http.StatusUnauthorized, "SESSION_EXPIRED")
	assertHTTPSError(t, sendHTTPS(t, client, http.MethodGet, base, "/api/v1/auth/session", ""), http.StatusUnauthorized, "UNAUTHORIZED")
	assertHTTPSError(t, sendHTTPS(t, client, http.MethodPost, base, "/api/v1/auth/refresh", ""), http.StatusUnauthorized, "SESSION_EXPIRED")
}

func restartPostgresSession(t *testing.T, f postgresSessionFixture) postgresSessionFixture {
	t.Helper()
	schema := f.pool.Config().ConnConfig.RuntimeParams["search_path"]
	f.pool.Close()
	cfg, err := pgxpool.ParseConfig(os.Getenv("AUTH_TEST_DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(f.ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	auth := service.NewAuth(repository.NewAuth(pool), testutil.TokenIssuer(t))
	return postgresSessionFixture{ctx: f.ctx, pool: pool, auth: auth, original: f.original}
}

func assertFamilyFullyRevoked(t *testing.T, f postgresSessionFixture, sessionID string) {
	t.Helper()
	var sessionRevoked bool
	var liveTokens int
	err := f.pool.QueryRow(f.ctx, `
		SELECT s.revoked_at IS NOT NULL,
		       (SELECT count(*) FROM refresh_tokens r WHERE r.session_id = s.id AND r.revoked_at IS NULL)
		FROM sessions s WHERE s.id = $1`, sessionID).Scan(&sessionRevoked, &liveTokens)
	if err != nil {
		t.Fatal(err)
	}
	if !sessionRevoked || liveTokens != 0 {
		t.Fatalf("session revoked=%t with %d unrevoked refresh tokens", sessionRevoked, liveTokens)
	}
}

func mustURL(t *testing.T, raw string) *url.URL {
	t.Helper()
	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	return parsed
}

func sendHTTPS(t *testing.T, client *http.Client, method string, base *url.URL, path, body string) *http.Response {
	t.Helper()
	request, err := http.NewRequest(method, base.String()+path, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	response, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	return response
}

// assertHTTPSStatus also checks that no credential value leaks into a body.
func assertHTTPSStatus(t *testing.T, response *http.Response, status int) string {
	t.Helper()
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != status {
		t.Fatalf("status = %d, want %d: %s", response.StatusCode, status, body)
	}
	for _, cookie := range response.Cookies() {
		if cookie.Value != "" && strings.Contains(string(body), cookie.Value) {
			t.Fatalf("%s value exposed in response body", cookie.Name)
		}
	}
	return string(body)
}

func assertHTTPSError(t *testing.T, response *http.Response, status int, code string) {
	t.Helper()
	if len(response.Cookies()) != 0 {
		t.Fatal("a rejected request must not issue credential cookies")
	}
	body := assertHTTPSStatus(t, response, status)
	if !strings.Contains(body, `"code":"`+code+`"`) {
		t.Fatalf("error body %s lacks code %s", body, code)
	}
}

// assertJarScoping proves Path scoping through the client jar.
func assertJarScoping(t *testing.T, jar http.CookieJar, base *url.URL) {
	t.Helper()
	session := *base
	session.Path = "/api/v1/auth/session"
	for _, cookie := range jar.Cookies(&session) {
		if cookie.Name == "ft_refresh" {
			t.Fatal("ft_refresh would be sent outside its refresh path")
		}
	}
	jarCookie(t, jar, base, "/api/v1/auth/session", "ft_session")
}

// assertSecureCredentialCookies checks the Set-Cookie attributes sent over TLS.
func assertSecureCredentialCookies(t *testing.T, response *http.Response) {
	t.Helper()
	paths := map[string]string{"ft_session": "/", "ft_refresh": "/api/v1/auth/refresh"}
	cookies := response.Cookies()
	if len(cookies) != len(paths) {
		t.Fatalf("expected %d credential cookies, got %d", len(paths), len(cookies))
	}
	for _, cookie := range cookies {
		path, known := paths[cookie.Name]
		if !known || cookie.Path != path || !cookie.Secure || !cookie.HttpOnly || cookie.SameSite != http.SameSiteLaxMode {
			t.Fatalf("credential cookie %s has unexpected attributes: %s", cookie.Name, cookie.String())
		}
	}
}

func jarCookie(t *testing.T, jar http.CookieJar, base *url.URL, path, name string) string {
	t.Helper()
	target := *base
	target.Path = path
	for _, cookie := range jar.Cookies(&target) {
		if cookie.Name == name {
			return cookie.Value
		}
	}
	t.Fatalf("cookie %s is not sent to %s", name, path)
	return ""
}
