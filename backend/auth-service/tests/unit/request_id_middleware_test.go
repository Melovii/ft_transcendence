package unit_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/middleware/requestid"
)

// TestRequestIDMiddleware checks request-ID selection and context preservation.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - Missing, empty, valid, 128-byte, oversized, whitespace, Unicode, control-character,
//     repeated and comma-separated headers.
//   - An already canceled parent context containing a custom value.
//
// Flow:
//
//  1. Check ID accessors return empty strings without middleware.
//  2. Send each header case through the middleware and capture Gin/context/response IDs.
//  3. Check valid upstream IDs are preserved and generated IDs are unique across cases.
//
// Expected output:
//
//   - HTTP 204 with exactly one safe X-Request-ID value shared by Gin, request context and
//     response.
//   - Valid supplied IDs survive; invalid/missing IDs receive fresh safe IDs.
//   - The parent value and context.Canceled remain available.
func TestRequestIDMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	generated := make(map[string]bool)

	checkMissingRequestID(t)

	for _, tt := range requestIDCases() {
		t.Run(tt.name, func(t *testing.T) {
			checkRequestIDCase(t, tt, generated)
		})
	}
}

type requestIDCase struct {
	name    string
	headers []string
	want    string
}

func requestIDCases() []requestIDCase {
	return []requestIDCase{
		{"missing", nil, ""},
		{"another missing", nil, ""},
		{"empty", []string{""}, ""},
		{"upstream", []string{"gateway-123_ABC.456"}, "gateway-123_ABC.456"},
		{"maximum length", []string{strings.Repeat("a", 128)}, strings.Repeat("a", 128)},
		{"oversized", []string{strings.Repeat("a", 129)}, ""},
		{"whitespace", []string{" client-id "}, ""},
		{"unicode", []string{"istek-ş"}, ""},
		{"control characters", []string{"client\r\nforged-log"}, ""},
		{"repeated", []string{"first", "second"}, ""},
		{"comma separated", []string{"first,second"}, ""},
	}
}

func checkMissingRequestID(t *testing.T) {
	t.Helper()
	if requestid.FromContext(context.Background()) != "" {
		t.Fatal("context without middleware unexpectedly has an ID")
	}
	empty, _ := gin.CreateTestContext(httptest.NewRecorder())
	if requestid.Get(empty) != "" {
		t.Fatal("Gin context without middleware unexpectedly has an ID")
	}
}

type parentKey struct{}

func checkRequestIDCase(t *testing.T, tt requestIDCase, generated map[string]bool) {
	t.Helper()
	response, ginID, contextID := serveRequestIDCase(t, tt.headers)

	id := response.Header().Get(requestid.Header)
	if response.Code != http.StatusNoContent || !regexp.MustCompile(`^[A-Za-z0-9_.-]{1,128}$`).MatchString(id) || ginID != id || contextID != id {
		t.Fatalf("inconsistent request ID or response status: status=%d", response.Code)
	}
	if len(response.Header().Values(requestid.Header)) != 1 {
		t.Fatal("response must contain exactly one request ID")
	}

	if tt.want != "" {
		if id != tt.want {
			t.Fatal("valid upstream ID was not preserved")
		}
	} else {
		if generated[id] {
			t.Fatal("generated ID was reused across requests")
		}
		generated[id] = true
	}
}

func serveRequestIDCase(t *testing.T, headers []string) (*httptest.ResponseRecorder, string, string) {
	t.Helper()
	var ginID, contextID string
	router := gin.New()
	router.Use(requestid.Middleware())
	router.GET("/", func(c *gin.Context) {
		ginID = requestid.Get(c)
		contextID = requestid.FromContext(c.Request.Context())
		if c.Request.Context().Value(parentKey{}) != "preserved" || c.Request.Context().Err() != context.Canceled {
			t.Error("request ID middleware lost parent context data or cancellation")
		}
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	ctx, cancel := context.WithCancel(context.WithValue(request.Context(), parentKey{}, "preserved"))
	cancel()
	request = request.WithContext(ctx)
	for _, header := range headers {
		request.Header.Add(requestid.Header, header)
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response, ginID, contextID
}
