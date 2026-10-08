package unit_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/middleware/authentication"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/model"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
)

type fakeAuthenticator struct {
	identity service.Identity
	err      error
	raw      string
	calls    int
}

func (f *fakeAuthenticator) Authenticate(ctx context.Context, raw string) (service.Identity, error) {
	f.calls++
	f.raw = raw
	return f.identity, f.err
}

func TestAuthenticationStoresIdentityOnBothContexts(t *testing.T) {
	auth := &fakeAuthenticator{identity: service.Identity{
		User: model.User{ID: 42, Username: "player"}, SessionID: "session", ExpiresAt: time.Now(),
	}}
	router := guardedRoute(auth, func(c *gin.Context) {
		ginIdentity, ginOK := authentication.Get(c)
		requestIdentity, requestOK := authentication.FromContext(c.Request.Context())
		if !ginOK || !requestOK || ginIdentity != auth.identity || requestIdentity != auth.identity {
			t.Error("authenticated identity is missing from Gin or request context")
		}
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodGet, "/session", nil)
	request.AddCookie(&http.Cookie{Name: "ft_session", Value: "cookie-token"})
	request.Header.Set("Authorization", "Bearer ignored-token")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent || auth.raw != "cookie-token" || auth.calls != 1 {
		t.Fatalf("unexpected authentication result: status=%d, auth=%+v", response.Code, auth)
	}
}

type rejectCase struct {
	name, cookie, header string
	err                  error
	status, calls        int
	code                 string
}

func TestAuthenticationRejectsMissingAndInvalidCookies(t *testing.T) {
	cases := []rejectCase{
		{name: "missing_cookie", status: 401, code: "UNAUTHORIZED"},
		{name: "empty_cookie", cookie: "ft_session=", status: 401, code: "UNAUTHORIZED"},
		{name: "bearer_only", header: "Bearer token", status: 401, code: "UNAUTHORIZED"},
		{name: "invalid_cookie", cookie: "ft_session=invalid", err: service.ErrUnauthorized, status: 401, calls: 1, code: "UNAUTHORIZED"},
		{name: "wrapped_error", cookie: "ft_session=invalid", err: fmt.Errorf("detail: %w", service.ErrUnauthorized), status: 401, calls: 1, code: "UNAUTHORIZED"},
		{name: "repository_error", cookie: "ft_session=valid", err: errors.New("database secret failure"), status: 500, calls: 1, code: "INTERNAL_ERROR"},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) { assertRejectedRequest(t, test) })
	}
}

func assertRejectedRequest(t *testing.T, test rejectCase) {
	t.Helper()
	auth := &fakeAuthenticator{err: test.err}
	called := false
	router := guardedRoute(auth, func(c *gin.Context) { called = true })
	request := httptest.NewRequest(http.MethodGet, "/session", nil)
	request.Header.Set("Cookie", test.cookie)
	request.Header.Set("Authorization", test.header)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != test.status || called || auth.calls != test.calls {
		t.Fatalf("request was not rejected correctly: status=%d, called=%t, authCalls=%d", response.Code, called, auth.calls)
	}
	assertPublicError(t, response, test.code)
}

func assertPublicError(t *testing.T, response *httptest.ResponseRecorder, code string) {
	t.Helper()
	var envelope struct {
		Error struct {
			Code    string         `json:"code"`
			Message string         `json:"message"`
			Details map[string]any `json:"details"`
		} `json:"error"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Error.Code != code || envelope.Error.Details == nil || strings.Contains(response.Body.String(), "secret") {
		t.Fatalf("unsafe or invalid error envelope: %s", response.Body.String())
	}
	if code == "UNAUTHORIZED" && envelope.Error.Message != "A valid active session is required." {
		t.Fatalf("unauthorized response does not match the contract: %s", response.Body.String())
	}
}

func TestAuthenticationContextGettersWithoutMiddleware(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	if _, ok := authentication.Get(c); ok {
		t.Fatal("Gin context has an identity without authentication")
	}
	if _, ok := authentication.FromContext(context.Background()); ok {
		t.Fatal("request context has an identity without authentication")
	}
}

func guardedRoute(auth authentication.Authenticator, handler gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/session", authentication.Middleware(auth), handler)
	return router
}
