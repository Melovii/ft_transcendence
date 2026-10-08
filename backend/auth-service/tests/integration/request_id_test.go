package integration_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/controller"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/middleware/requestid"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/server"
	"github.com/melmut-42/ft_transcendence/backend/auth-service/internal/service"
)

// TestRequestIDServer checks request/log correlation for all HTTP response paths.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - text and json log formats; success, invalid registration, missing route, wrong method and
//     panic requests.
//   - A valid upstream request ID and a query containing a private token value.
//
// Flow:
//
//  1. Create a server with probe/panic routes and a spy rejecting unexpected service dispatch.
//  2. Send each request, then inspect response status, ID header and error envelope.
//  3. Find access-log records and check their correlation fields and absence of sensitive
//     values.
//
// Expected output:
//
//   - Statuses 204, 400, 404, 405 and 500 with the supplied request ID.
//   - Error codes VALIDATION_ERROR, NOT_FOUND, METHOD_NOT_ALLOWED and INTERNAL_ERROR as
//     appropriate.
//   - Exactly one access log per request with matching ID/status/service; JSON also matches the
//     URL path.
//   - Private query and panic values appear in neither the checked error bodies nor log output.
func TestRequestIDServer(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, format := range []string{"text", "json"} {
		t.Run(format, func(t *testing.T) {
			checkRequestIDServerFormat(t, format)
		})
	}
}

type requestIDServerCase struct {
	name, method, path, body string
	status                   int
}

func requestIDServerCases() []requestIDServerCase {
	return []requestIDServerCase{
		{"success", http.MethodGet, "/probe", "", 204},
		{"validation", http.MethodPost, "/api/v1/auth/register", "{", 400},
		{"not-found", http.MethodGet, "/missing", "", 404},
		{"method-not-allowed", http.MethodGet, "/api/v1/auth/register", "", 405},
		{"recovery", http.MethodGet, "/panic", "", 500},
	}
}

func checkRequestIDServerFormat(t *testing.T, format string) {
	t.Helper()
	var logs strings.Builder
	spy := registrationServiceFunc(func(_ context.Context, _ service.RegisterInput) (service.AuthResult, error) {
		t.Error("invalid request reached service")
		return service.AuthResult{}, service.ErrInvalidEmail
	})
	router := server.New("0", controller.NewAuth(spy), testLogger(t, format, "info", &logs)).Handler.(*gin.Engine)
	router.GET("/probe", func(c *gin.Context) { c.Status(http.StatusNoContent) })
	router.GET("/panic", func(_ *gin.Context) { panic("private-panic-value") })
	for _, tt := range requestIDServerCases() {
		t.Run(tt.name, func(t *testing.T) {
			checkRequestIDServerCase(t, router, &logs, format, tt)
		})
	}
}

func checkRequestIDServerCase(t *testing.T, router *gin.Engine, logs *strings.Builder, format string, tt requestIDServerCase) {
	t.Helper()
	logs.Reset()
	id := "request-" + tt.name
	request := httptest.NewRequest(tt.method, tt.path+"?token=private-query-value", strings.NewReader(tt.body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set(requestid.Header, id)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != tt.status || response.Header().Get(requestid.Header) != id {
		t.Fatalf("request ID missing or unexpected status: %d", response.Code)
	}
	checkRequestIDErrorResponse(t, response, tt.status)
	checkRequestIDAccessLogs(t, logs.String(), format, id, tt)
}

func checkRequestIDErrorResponse(t *testing.T, response *httptest.ResponseRecorder, status int) {
	t.Helper()
	if status >= 400 {
		var envelope struct {
			Error struct {
				Code    string         `json:"code"`
				Message string         `json:"message"`
				Details map[string]any `json:"details"`
			} `json:"error"`
		}
		codes := map[int]string{400: "VALIDATION_ERROR", 404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED", 500: "INTERNAL_ERROR"}
		if err := json.Unmarshal(response.Body.Bytes(), &envelope); err != nil || envelope.Error.Code != codes[status] || envelope.Error.Message == "" || envelope.Error.Details == nil {
			t.Fatalf("incorrect error envelope: %s", response.Body)
		}
		if !strings.HasPrefix(response.Header().Get("Content-Type"), "application/json") || strings.Contains(response.Body.String(), "private") {
			t.Fatalf("invalid or unsafe error response: %s", response.Body)
		}
	}
}

func checkRequestIDAccessLogs(t *testing.T, output, format, id string, tt requestIDServerCase) {
	t.Helper()
	accessCount := 0
	for _, line := range strings.Split(strings.TrimSpace(output), "\n") {
		if checkRequestIDAccessRecord(t, line, format, id, tt) {
			accessCount++
		}
	}
	if accessCount != 1 {
		t.Fatalf("expected one access log: %s", output)
	}
	if strings.Contains(output, "private-query-value") || strings.Contains(output, "private-panic-value") {
		t.Fatal("sensitive value leaked into log")
	}
}

func checkRequestIDAccessRecord(t *testing.T, line, format, id string, tt requestIDServerCase) bool {
	t.Helper()
	if format == "json" {
		var record map[string]any
		if err := json.Unmarshal([]byte(line), &record); err != nil {
			t.Fatalf("invalid JSON log: %v: %s", err, line)
		}
		if record["msg"] != "http_request" {
			return false
		}
		if record["request_id"] != id || record["status"] != float64(tt.status) || record["path"] != tt.path || record["service"] != "auth-service" {
			t.Fatalf("access log did not correlate with response: %s", line)
		}
		return true
	} else if strings.Contains(line, "msg=http_request") {
		if !strings.Contains(line, "request_id="+id) || !strings.Contains(line, fmt.Sprintf("status=%d", tt.status)) || !strings.Contains(line, "service=auth-service") {
			t.Fatalf("access log did not correlate with response: %s", line)
		}
	}
	return strings.Contains(line, "msg=http_request")
}
