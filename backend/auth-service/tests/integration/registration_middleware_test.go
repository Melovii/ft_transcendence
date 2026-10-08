package integration_test

import (
	"context"
	"io"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/controller"
	authrouter "github.com/melmut-42/ft_transcendence/backend/auth-service/internal/router"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/server"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/testutil"
)

// TestRegisterMiddleware checks validation before service dispatch.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - Malformed JSON, invalid email/username/password and valid input containing surrounding
//     spaces.
//   - A spy service returning ErrEmailTaken when invoked.
//
// Flow:
//
//  1. Build the HTTP server with the spy for each case.
//  2. POST the payload and capture service-call count and received input.
//
// Expected output:
//
//   - Malformed JSON returns 400; invalid fields return 422; both invoke the service zero
//     times.
//   - Valid input invokes the service once and returns the stubbed 409 conflict.
//   - The service receives trimmed email/username and the unchanged password, including spaces.
func TestRegisterMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	for _, tt := range registerMiddlewareCases() {
		t.Run(tt.name, func(t *testing.T) {
			calls := 0
			var received service.RegisterInput
			spy := registrationServiceFunc(func(_ context.Context, input service.RegisterInput) (service.AuthResult, error) {
				calls++
				received = input
				return service.AuthResult{}, service.ErrEmailTaken
			})
			handler := server.New("0", controller.NewAuth(spy), testLogger(t, "text", "info", io.Discard)).Handler
			response := requestRegister(handler, tt.body, "application/json")

			if response.Code != tt.status || calls != tt.calls {
				t.Fatalf("status=%d calls=%d; want status=%d calls=%d", response.Code, calls, tt.status, tt.calls)
			}

			if calls > 0 && (received.Email != "p@example.com" || received.Username != "player" || received.Password != " password ") {
				t.Fatal("middleware did not normalize identity fields or preserve password whitespace")
			}
		})
	}
}

// TestRegisterWithoutValidation checks a route missing validation middleware.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - Valid JSON posted to a controller route installed without ValidateRegister.
//   - A spy service counting attempted dispatches.
//
// Flow:
//
//  1. Install only the wrapped registration controller.
//  2. POST the input and inspect the response and spy count.
//
// Expected output:
//
//   - HTTP 500 INTERNAL_ERROR and zero service calls because validated context input is
//     missing.
func TestRegisterWithoutValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	calls := 0
	spy := registrationServiceFunc(func(_ context.Context, _ service.RegisterInput) (service.AuthResult, error) {
		calls++
		return service.AuthResult{}, nil
	})
	router := gin.New()
	router.POST("/api/v1/auth/register", authrouter.Wrap(controller.NewAuth(spy).Register, nil))

	response := requestRegister(router, inputJSON(t, testutil.ValidInput()), "application/json")
	if response.Code != 500 || calls != 0 || !strings.Contains(response.Body.String(), "INTERNAL_ERROR") {
		t.Fatalf("missing middleware did not fail closed: status=%d calls=%d", response.Code, calls)
	}
}

type registerMiddlewareCase struct {
	name   string
	body   string
	status int
	calls  int
}

func registerMiddlewareCases() []registerMiddlewareCase {
	return []registerMiddlewareCase{
		{"malformed JSON", "{", 400, 0},
		{"invalid email", `{"email":"bad","username":"player","password":"12345678"}`, 422, 0},
		{"invalid username", `{"email":"p@example.com","username":"!","password":"12345678"}`, 422, 0},
		{"invalid password", `{"email":"p@example.com","username":"player","password":"short"}`, 422, 0},
		{"valid normalized input", `{"email":" p@example.com ","username":" player ","password":" password "}`, 409, 1},
	}
}
