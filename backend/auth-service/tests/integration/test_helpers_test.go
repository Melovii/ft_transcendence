package integration_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/controller"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/server"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
	"github.com/melmut-42/ft_transcendence/backend/shared/logging"
)

// testLogger creates a logger for auth-service tests.
//
// Parameters:
//
//   - t: Go test runner used to report setup failures.
//   - format: Log output format, such as text or json.
//   - level: Minimum log severity.
//   - output: Writer receiving the log records.
//
// Flow:
//
//  1. Build a logging.Config with service name auth-service.
//  2. Create the logger using the supplied writer; fail the test on setup errors.
//
// Expected output:
//
//   - A configured *slog.Logger that writes to output.
func testLogger(t *testing.T, format, level string, output io.Writer) *slog.Logger {
	t.Helper()
	logger, err := logging.New(logging.Config{Format: format, Level: level, Service: "auth-service"}, output)
	if err != nil {
		t.Fatal(err)
	}
	return logger
}

// authHandler assembles the registration HTTP handler without opening a listener.
//
// Parameters:
//
//   - t: Go test runner used to report logger setup failures.
//   - repo: Repository used for registration transactions.
//   - issuer: Provider used to generate session and token credentials.
//
// Flow:
//
//  1. Enable Gin test mode.
//  2. Wire the repository and issuer into the service and controller.
//  3. Build the HTTP server with a text/info logger writing to io.Discard.
//
// Expected output:
//
//   - An http.Handler exposing the auth routes and server middleware.
func authHandler(t *testing.T, repo service.AuthRepository, issuer service.CredentialIssuer) http.Handler {
	t.Helper()
	gin.SetMode(gin.TestMode)
	return server.New("0", controller.NewAuth(service.NewAuth(repo, issuer)), testLogger(t, "text", "info", io.Discard)).Handler
}

// requestRegister dispatches a registration request in memory.
//
// Parameters:
//
//   - handler: HTTP handler receiving the request.
//   - body: Raw request body, including malformed payloads for negative tests.
//   - contentType: Value of the request Content-Type header.
//
// Flow:
//
//  1. Create POST /api/v1/auth/register with body and the Content-Type header.
//  2. Serve the request through handler using a response recorder.
//
// Expected output:
//
//   - A *httptest.ResponseRecorder containing the status, headers and body.
func requestRegister(handler http.Handler, body, contentType string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", strings.NewReader(body))
	request.Header.Set("Content-Type", contentType)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

// inputJSON encodes registration input for HTTP tests.
//
// Parameters:
//
//   - t: Go test runner used to report encoding failures.
//   - input: Registration values to encode.
//
// Flow:
//
//  1. Marshal email, username and password into a JSON object.
//  2. Fail the test if marshaling fails.
//
// Expected output:
//
//   - A JSON string containing all three input fields, including the password.
func inputJSON(t *testing.T, input service.RegisterInput) string {
	t.Helper()
	body, err := json.Marshal(map[string]string{"email": input.Email, "username": input.Username, "password": input.Password})
	if err != nil {
		t.Fatal(err)
	}

	return string(body)
}

type registrationServiceFunc func(context.Context, service.RegisterInput) (service.AuthResult, error)

// Register adapts a test callback to the controller registration service.
//
// Parameters:
//
//   - fn: Callback used as a spy or stub registration service.
//   - ctx: Request context forwarded unchanged.
//   - input: Validated registration input forwarded unchanged.
//
// Flow:
//
//  1. Invoke fn with ctx and input and forward its return values.
//
// Expected output:
//
//   - Exactly the AuthResult and error supplied by the callback.
func (fn registrationServiceFunc) Register(ctx context.Context, input service.RegisterInput) (service.AuthResult, error) {
	return fn(ctx, input)
}
