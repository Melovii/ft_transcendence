package integration_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/testutil"
)

func TestSessionRefreshLogoutHTTP(t *testing.T) {
	repo := &testutil.MemoryRepository{}
	handler := authHandler(t, repo, testutil.TokenIssuer(t))
	registered := registerForSession(t, handler)
	login := requestAuth(handler, http.MethodPost, "/login", loginJSON(testutil.ValidInput().Email, testutil.ValidInput().Password))
	if login.Code != http.StatusOK {
		t.Fatalf("login failed: %d %s", login.Code, login.Body)
	}
	current := credentialCookies(t, login)
	checkSessionResponse(t, requestAuth(handler, http.MethodGet, "/session", "", current["ft_session"]), repo.Users[0].ID)
	refreshed := refreshForSession(t, handler, current)
	if len(repo.Sessions) != 2 || len(repo.Refresh) != 3 {
		t.Fatal("refresh must preserve the session and append one rotation record")
	}
	checkSessionResponse(t, requestAuth(handler, http.MethodGet, "/session", "", refreshed["ft_session"]), repo.Users[0].ID)
	logout := requestAuth(handler, http.MethodDelete, "/session", "", refreshed["ft_session"])
	checkLogoutResponse(t, logout)
	checkAuthError(t, requestAuth(handler, http.MethodGet, "/session", "", current["ft_session"]), 401, "UNAUTHORIZED")
	checkAuthError(t, requestAuth(handler, http.MethodGet, "/session", "", refreshed["ft_session"]), 401, "UNAUTHORIZED")
	checkAuthError(t, requestAuth(handler, http.MethodPost, "/refresh", "", refreshed["ft_refresh"]), 401, "SESSION_EXPIRED")
	checkSessionResponse(t, requestAuth(handler, http.MethodGet, "/session", "", registered["ft_session"]), repo.Users[0].ID)
}

func TestRefreshReplayRevokesFamilyHTTP(t *testing.T) {
	repo := &testutil.MemoryRepository{}
	handler := authHandler(t, repo, testutil.TokenIssuer(t))
	initial := registerForSession(t, handler)
	rotated := refreshForSession(t, handler, initial)
	checkAuthError(t, requestAuth(handler, http.MethodPost, "/refresh", "", initial["ft_refresh"]), 401, "SESSION_EXPIRED")
	checkAuthError(t, requestAuth(handler, http.MethodGet, "/session", "", rotated["ft_session"]), 401, "UNAUTHORIZED")
	checkAuthError(t, requestAuth(handler, http.MethodPost, "/refresh", "", rotated["ft_refresh"]), 401, "SESSION_EXPIRED")
	if len(repo.Sessions) != 1 || repo.Sessions[0].RevokedAt == nil {
		t.Fatal("refresh reuse must commit family revocation despite its error response")
	}
}

func TestSessionRoutesRejectMissingOrInvalidCookies(t *testing.T) {
	handler := authHandler(t, &testutil.MemoryRepository{}, testutil.TokenIssuer(t))
	for _, method := range []string{http.MethodGet, http.MethodDelete} {
		checkAuthError(t, requestAuth(handler, method, "/session", ""), 401, "UNAUTHORIZED")
		checkAuthError(t, requestAuth(handler, method, "/session", "", &http.Cookie{Name: "ft_session", Value: "bad-token"}), 401, "UNAUTHORIZED")
	}
	checkAuthError(t, requestAuth(handler, http.MethodPost, "/refresh", ""), 401, "SESSION_EXPIRED")
	checkAuthError(t, requestAuth(handler, http.MethodPost, "/refresh", "", &http.Cookie{Name: "ft_refresh", Value: "bad-token"}), 401, "SESSION_EXPIRED")
}

func TestRefreshRejectsBodyCredentials(t *testing.T) {
	repo := &testutil.MemoryRepository{}
	handler := authHandler(t, repo, testutil.TokenIssuer(t))
	initial := registerForSession(t, handler)
	response := requestAuth(handler, http.MethodPost, "/refresh", `{"refresh_token":"body-credential"}`, initial["ft_refresh"])
	checkAuthError(t, response, http.StatusBadRequest, "VALIDATION_ERROR")
	if len(repo.Refresh) != 1 || repo.Refresh[0].RevokedAt != nil {
		t.Fatal("body credentials must be rejected before rotation")
	}
	refreshForSession(t, handler, initial)
}

func TestSessionTransactionErrorsEmitNoCookies(t *testing.T) {
	for _, path := range []string{"/login", "/refresh", "/session"} {
		t.Run(path, func(t *testing.T) {
			repo := &testutil.MemoryRepository{}
			handler := authHandler(t, repo, testutil.TokenIssuer(t))
			current := registerForSession(t, handler)
			repo.CommitErr = errors.New("private PostgreSQL connection details")
			response := requestSessionFailure(handler, path, current)
			checkAuthError(t, response, http.StatusInternalServerError, "INTERNAL_ERROR")
			if strings.Contains(response.Body.String(), "private") || len(repo.Sessions) != 1 || len(repo.Refresh) != 1 {
				t.Fatal("failed transaction exposed private data or committed credentials")
			}
			repo.CommitErr = nil
			checkSessionResponse(t, requestAuth(handler, http.MethodGet, "/session", "", current["ft_session"]), repo.Users[0].ID)
			refreshForSession(t, handler, current)
		})
	}
}

func requestSessionFailure(handler http.Handler, path string, current map[string]*http.Cookie) *httptest.ResponseRecorder {
	switch path {
	case "/login":
		return requestAuth(handler, http.MethodPost, path, loginJSON(testutil.ValidInput().Email, testutil.ValidInput().Password))
	case "/refresh":
		return requestAuth(handler, http.MethodPost, path, "", current["ft_refresh"])
	default:
		return requestAuth(handler, http.MethodDelete, path, "", current["ft_session"])
	}
}

func refreshForSession(t *testing.T, handler http.Handler, current map[string]*http.Cookie) map[string]*http.Cookie {
	t.Helper()
	response := requestAuth(handler, http.MethodPost, "/refresh", "", current["ft_refresh"])
	if response.Code != http.StatusOK {
		t.Fatalf("refresh failed: %d %s", response.Code, response.Body)
	}
	checkRefreshBody(t, response)
	rotated := credentialCookies(t, response)
	if rotated["ft_refresh"].Value == current["ft_refresh"].Value {
		t.Fatal("refresh token was not rotated")
	}
	previous := testutil.ParseClaims(t, current["ft_session"].Value)
	next := testutil.ParseClaims(t, rotated["ft_session"].Value)
	if next.SessionID != previous.SessionID || next.Subject != previous.Subject {
		t.Fatal("refresh must preserve its user and session family")
	}
	return rotated
}

func checkRefreshBody(t *testing.T, response *httptest.ResponseRecorder) {
	t.Helper()
	var body struct {
		Data map[string]json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	var expires time.Time
	if len(body.Data) != 1 || json.Unmarshal(body.Data["access_token_expires_at"], &expires) != nil || !expires.After(time.Now()) {
		t.Fatal("refresh must return only the access-token expiration")
	}
}

func checkLogoutResponse(t *testing.T, response *httptest.ResponseRecorder) {
	t.Helper()
	checkNoStore(t, response)
	if response.Code != http.StatusNoContent || response.Body.Len() != 0 {
		t.Fatalf("logout failed: %d %s", response.Code, response.Body)
	}
	cookies := response.Result().Cookies()
	if len(cookies) != 2 {
		t.Fatal("logout must expire both cookies")
	}
	for _, cookie := range cookies {
		if cookie.Value != "" || cookie.MaxAge != -1 || !cookie.Expires.Before(time.Now()) || !cookie.Secure || !cookie.HttpOnly {
			t.Fatalf("cookie was not safely expired: %s", cookie.Name)
		}
		if cookie.SameSite != http.SameSiteLaxMode || (cookie.Name == "ft_session" && cookie.Path != "/") {
			t.Fatal("logout access cookie attributes differ from issuance")
		}
		if cookie.Name == "ft_refresh" && cookie.Path != "/api/v1/auth/refresh" {
			t.Fatal("logout refresh cookie path differs from issuance")
		}
	}
}
