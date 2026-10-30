package unit_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/melmut-42/ft_transcendence/backend/user-service/internal/middleware/requestid"
)

// requestIDEngine returns a router that echoes the request ID seen by a handler.
//
// Parameters:
//
//   - t: Go test runner; Gin is put in test mode.
//
// Expected output:
//
//   - An engine with the middleware whose GET /id handler returns the ID from the
//     request context, so tests can compare it with the response header.
func requestIDEngine(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(requestid.Middleware())
	engine.GET("/id", func(c *gin.Context) {
		c.String(http.StatusOK, requestid.FromContext(c.Request.Context()))
	})
	return engine
}

// TestRequestIDKeepsOneValidHeader checks that a usable client ID is preserved.
//
// Parameters:
//
//   - t: Go test runner used for assertions and failure reporting.
//
// Expected output:
//
//   - The response header and the handler's context carry the client's ID.
func TestRequestIDKeepsOneValidHeader(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/id", nil)
	request.Header.Set(requestid.Header, "client-id_1.2")

	requestIDEngine(t).ServeHTTP(recorder, request)

	if got := recorder.Header().Get(requestid.Header); got != "client-id_1.2" {
		t.Fatalf("response header = %q, want the client ID", got)
	}
	if body := recorder.Body.String(); body != "client-id_1.2" {
		t.Fatalf("context ID = %q, want the client ID", body)
	}
}

// TestRequestIDReplacesUnusableHeaders checks that bad IDs are replaced, not rejected.
//
// Parameters:
//
//   - t: Go test runner used for subtests and assertions.
//
// Expected output:
//
//   - Status 200 and a fresh ID in the header and context for a missing, empty,
//     over-long, badly formatted or repeated header.
func TestRequestIDReplacesUnusableHeaders(t *testing.T) {
	tests := []struct {
		name   string
		values []string
	}{
		{"missing", nil},
		{"empty", []string{""}},
		{"too long", []string{strings.Repeat("a", 129)}},
		{"bad characters", []string{"id with spaces"}},
		{"repeated", []string{"first", "second"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/id", nil)
			for _, value := range tt.values {
				request.Header.Add(requestid.Header, value)
			}

			requestIDEngine(t).ServeHTTP(recorder, request)

			generated := recorder.Header().Get(requestid.Header)
			if recorder.Code != http.StatusOK || generated == "" {
				t.Fatalf("status = %d, header = %q; want 200 and a generated ID", recorder.Code, generated)
			}
			for _, value := range tt.values {
				if value != "" && generated == value {
					t.Fatalf("unusable ID %q was kept", value)
				}
			}
			if recorder.Body.String() != generated {
				t.Fatalf("context ID %q differs from header %q", recorder.Body.String(), generated)
			}
		})
	}
}
