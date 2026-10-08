package integration_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/controller"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/server"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/testutil"
)

func TestLoginHTTP(t *testing.T) {
	repo := &testutil.MemoryRepository{}
	handler := authHandler(t, repo, testutil.TokenIssuer(t))
	registered := registerForSession(t, handler)
	response := requestAuth(handler, http.MethodPost, "/login", loginJSON(" PLAYER@EXAMPLE.COM ", testutil.ValidInput().Password))
	if response.Code != http.StatusOK || len(repo.Users) != 1 || len(repo.Sessions) != 2 || len(repo.Refresh) != 2 {
		t.Fatalf("login failed: %d %s", response.Code, response.Body)
	}
	checkRegistrationBody(t, response, repo.Users[0], testutil.ValidInput().Password)
	login := credentialCookies(t, response)
	if login["ft_session"].Value == registered["ft_session"].Value {
		t.Fatal("login must issue an independent session")
	}
	checkSessionResponse(t, requestAuth(handler, http.MethodGet, "/session", "", registered["ft_session"]), repo.Users[0].ID)
}

func TestLoginInvalidCredentialsIndistinguishable(t *testing.T) {
	repo := &testutil.MemoryRepository{}
	handler := authHandler(t, repo, testutil.TokenIssuer(t))
	registerForSession(t, handler)
	wrong := requestAuth(handler, http.MethodPost, "/login", loginJSON(testutil.ValidInput().Email, "incorrect"))
	unknown := requestAuth(handler, http.MethodPost, "/login", loginJSON("unknown@example.com", "incorrect"))
	checkAuthError(t, wrong, http.StatusUnauthorized, "INVALID_CREDENTIALS")
	checkAuthError(t, unknown, http.StatusUnauthorized, "INVALID_CREDENTIALS")
	if wrong.Body.String() != unknown.Body.String() || len(repo.Sessions) != 1 || len(repo.Refresh) != 1 {
		t.Fatal("invalid login must not reveal account existence or create credentials")
	}
}

func TestLoginValidationBeforeDispatch(t *testing.T) {
	for _, tt := range loginValidationCases() {
		t.Run(tt.name, func(t *testing.T) {
			spy := &loginServiceSpy{err: service.ErrInvalidCredentials}
			handler := loginSpyHandler(t, spy)
			response := requestAuth(handler, http.MethodPost, "/login", tt.body)
			checkAuthError(t, response, http.StatusBadRequest, "VALIDATION_ERROR")
			if spy.calls != 0 {
				t.Fatal("invalid login input reached credential verification")
			}
		})
	}
}

func TestLoginAllowsShortPasswordsAndPreservesWhitespace(t *testing.T) {
	for _, password := range []string{"x", " password "} {
		spy := &loginServiceSpy{err: service.ErrInvalidCredentials}
		response := requestAuth(loginSpyHandler(t, spy), http.MethodPost, "/login", loginJSON(" p@example.com ", password))
		checkAuthError(t, response, http.StatusUnauthorized, "INVALID_CREDENTIALS")
		if spy.calls != 1 || spy.input.Email != "p@example.com" || spy.input.Password != password {
			t.Fatal("login normalization changed password or applied registration length rules")
		}
	}
}

func TestLoginInternalErrorsRemainPrivate(t *testing.T) {
	spy := &loginServiceSpy{err: errors.New("private database credentials")}
	response := requestAuth(loginSpyHandler(t, spy), http.MethodPost, "/login", loginJSON("p@example.com", "secret"))
	checkAuthError(t, response, http.StatusInternalServerError, "INTERNAL_ERROR")
	if strings.Contains(response.Body.String(), "private") || strings.Contains(response.Body.String(), "secret") {
		t.Fatal("internal error or credentials leaked")
	}
}

type loginServiceSpy struct {
	controller.SessionService
	calls int
	input service.LoginInput
	err   error
}

func (s *loginServiceSpy) Login(_ context.Context, input service.LoginInput) (service.AuthResult, error) {
	s.calls++
	s.input = input
	return service.AuthResult{}, s.err
}

func loginSpyHandler(t *testing.T, spy *loginServiceSpy) http.Handler {
	t.Helper()
	auth := controller.NewAuth(registrationServiceFunc(nil), controller.WithSessions(spy))
	return server.New("0", auth, testLogger(t, "text", "info", io.Discard)).Handler
}

func loginJSON(email, password string) string {
	body, _ := json.Marshal(map[string]string{"email": email, "password": password})
	return string(body)
}

type loginValidationCase struct {
	name, body string
}

func loginValidationCases() []loginValidationCase {
	return []loginValidationCase{
		{"malformed", "{"},
		{"array", "[]"},
		{"null", "null"},
		{"trailing object", "{} {}"},
		{"unknown field", `{"email":"p@example.com","password":"x","admin":true}`},
		{"missing fields", `{}`},
		{"missing password", `{"email":"p@example.com"}`},
		{"null password", `{"email":"p@example.com","password":null}`},
		{"numeric password", `{"email":"p@example.com","password":123}`},
		{"empty password", `{"email":"p@example.com","password":""}`},
		{"invalid email", `{"email":"bad","password":"x"}`},
		{"numeric email", `{"email":123,"password":"x"}`},
		{"null email", `{"email":null,"password":"x"}`},
		{"oversized", `{"email":"p@example.com","password":"` + strings.Repeat("x", 9000) + `"}`},
	}
}

func TestLoginContentTypeRequired(t *testing.T) {
	spy := &loginServiceSpy{err: service.ErrInvalidCredentials}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", strings.NewReader(loginJSON("p@example.com", "x")))
	request.Header.Set("Content-Type", "text/plain")
	response := httptest.NewRecorder()
	loginSpyHandler(t, spy).ServeHTTP(response, request)
	checkAuthError(t, response, http.StatusBadRequest, "VALIDATION_ERROR")
	if spy.calls != 0 {
		t.Fatal("unsupported content type reached login")
	}
}
