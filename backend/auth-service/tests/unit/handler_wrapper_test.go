package unit_test

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/router"
	"github.com/melmut-42/ft_transcendence/backend/shared/httpresponse"
)

// TestWrapErrors checks error mapping and handler-chain termination.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - Unknown, unmapped, wrapped domain and wrapped public errors; optional error mapper.
//   - Expected status/code pairs: 500/INTERNAL_ERROR, 409/CONFLICT and 429/RATE_LIMITED.
//
// Flow:
//
//  1. Install a wrapped handler returning the case error followed by a call-counting handler.
//  2. GET the route, decode the envelope and check whether the chain continued.
//
// Expected output:
//
//   - The response matches the case status/code and contains a non-null details object.
//   - The following handler is never called; private causes are absent from the body.
func TestWrapErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tt := range wrapErrorCases() {
		t.Run(tt.name, func(t *testing.T) {
			engine := gin.New()
			calls := 0
			engine.GET("/", router.Wrap(func(c *gin.Context) error { return tt.err }, tt.mapper), func(c *gin.Context) {
				calls++
				c.Status(204)
			})
			response := httptest.NewRecorder()
			engine.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/", nil))
			var body struct {
				Error httpresponse.Error `json:"error"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || response.Code != tt.status || calls != 0 || body.Error.Code != tt.code || body.Error.Details == nil {
				t.Fatalf("wrong error or chain continued: status=%d calls=%d body=%s", response.Code, calls, response.Body)
			}
			if strings.Contains(response.Body.String(), "private") {
				t.Fatal("private cause leaked")
			}
		})
	}
}

// TestWrapSuccessAndCommittedResponse checks successful chains and already-written responses.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - GET /success with successful validation and a JSON-writing handler.
//   - GET /committed with a handler writing HTTP 202 before returning an error.
//
// Flow:
//
//  1. Install both routes and dispatch each request.
//  2. Verify middleware state reaches the successful handler and compare exact response bodies.
//
// Expected output:
//
//   - The success route returns HTTP 201 with {"data":"created"}.
//   - The committed route keeps HTTP 202 and body already sent; the failed chain stops without
//     rewriting the response.
func TestWrapSuccessAndCommittedResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	registerWrappedTestRoutes(t, engine)
	for _, tt := range []struct {
		path   string
		status int
		body   string
	}{
		{"/success", 201, `{"data":"created"}`},
		{"/committed", 202, "already sent"},
	} {
		response := httptest.NewRecorder()
		engine.ServeHTTP(response, httptest.NewRequest(http.MethodGet, tt.path, nil))
		if response.Code != tt.status || response.Body.String() != tt.body {
			t.Fatalf("response was changed or written twice: %d %s", response.Code, response.Body)
		}
	}
}

type wrapErrorCase struct {
	name   string
	err    error
	mapper router.ErrorMapper
	status int
	code   string
}

func wrapErrorCases() []wrapErrorCase {
	domainError := errors.New("private domain cause")
	mapper := func(err error) *httpresponse.Error {
		if errors.Is(err, domainError) {
			return &httpresponse.Error{Status: 409, Code: "CONFLICT", Message: "The resource already exists."}
		}
		return nil
	}
	return []wrapErrorCase{
		{"unknown", errors.New("private database cause"), nil, 500, "INTERNAL_ERROR"},
		{"unmapped", errors.New("private unmapped cause"), mapper, 500, "INTERNAL_ERROR"},
		{"wrapped domain", fmt.Errorf("private context: %w", domainError), mapper, 409, "CONFLICT"},
		{"wrapped public", fmt.Errorf("private context: %w", &httpresponse.Error{Status: 429, Code: "RATE_LIMITED", Message: "Too many requests."}), mapper, 429, "RATE_LIMITED"},
	}
}

func registerWrappedTestRoutes(t *testing.T, engine *gin.Engine) {
	t.Helper()
	engine.GET("/success", router.Wrap(func(c *gin.Context) error {
		c.Set("validated", true)
		return nil
	}, nil), router.Wrap(func(c *gin.Context) error {
		if !c.GetBool("validated") {
			t.Error("middleware did not run")
		}
		c.JSON(201, gin.H{"data": "created"})
		return nil
	}, nil))
	engine.GET("/committed", router.Wrap(func(c *gin.Context) error {
		c.String(202, "already sent")
		return errors.New("late private failure")
	}, nil), func(c *gin.Context) { t.Error("failed handler continued") })
}
