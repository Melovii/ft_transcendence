package unit_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/melmut-42/ft_transcendence/backend/user-service/internal/controller"
	"github.com/melmut-42/ft_transcendence/backend/user-service/internal/server"
	"github.com/melmut-42/ft_transcendence/backend/user-service/internal/service"
)

// fakeProbe is a database probe whose answer and received context the test controls.
type fakeProbe struct {
	err      error
	deadline bool
}

func (f *fakeProbe) Ping(ctx context.Context) error {
	_, f.deadline = ctx.Deadline()
	return f.err
}

// fakeReadiness is a readiness check with a fixed answer.
type fakeReadiness struct{ err error }

func (f fakeReadiness) Ready(context.Context) error { return f.err }

// healthHandler assembles the HTTP handler around a readiness check, without a listener.
//
// Parameters:
//
//   - t: Go test runner; Gin is put in test mode.
//   - readiness: Check behind GET /readyz.
//
// Expected output:
//
//   - The server's handler with health routes and the common middleware.
func healthHandler(t *testing.T, readiness controller.Readiness) http.Handler {
	t.Helper()
	gin.SetMode(gin.TestMode)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	return server.New("0", controller.NewHealth(readiness), logger).Handler
}

// get dispatches one request in memory and returns the recorded response.
func get(handler http.Handler, method, path string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(method, path, nil))
	return recorder
}

// decode parses a JSON response body into a generic map.
func decode(t *testing.T, recorder *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("body %q is not JSON: %v", recorder.Body.String(), err)
	}
	return body
}

// TestHealthServiceReady checks the readiness verdict of the service layer.
//
// Parameters:
//
//   - t: Go test runner used for subtests and assertions.
//
// Expected output:
//
//   - nil when the probe succeeds; ErrDatabaseUnavailable wrapping the cause when it
//     fails; and the probe always receives a context with a deadline.
func TestHealthServiceReady(t *testing.T) {
	cause := errors.New("connection refused")
	tests := []struct {
		name    string
		probe   *fakeProbe
		wantErr bool
	}{
		{"database answers", &fakeProbe{}, false},
		{"database fails", &fakeProbe{err: cause}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.NewHealth(tt.probe).Ready(context.Background())

			if (err != nil) != tt.wantErr {
				t.Fatalf("Ready() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr && (!errors.Is(err, service.ErrDatabaseUnavailable) || !errors.Is(err, cause)) {
				t.Fatalf("Ready() error = %v, want ErrDatabaseUnavailable wrapping the cause", err)
			}
			if !tt.probe.deadline {
				t.Fatal("probe context has no deadline")
			}
		})
	}
}

// TestHealthServiceReadyHonorsCancellation checks that a canceled caller is not kept waiting.
//
// Parameters:
//
//   - t: Go test runner used for assertions and failure reporting.
//
// Expected output:
//
//   - ErrDatabaseUnavailable wrapping context.Canceled, returned without delay.
func TestHealthServiceReadyHonorsCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	probe := blockingProbe{}

	done := make(chan error, 1)
	go func() { done <- service.NewHealth(probe).Ready(ctx) }()

	select {
	case err := <-done:
		if !errors.Is(err, service.ErrDatabaseUnavailable) || !errors.Is(err, context.Canceled) {
			t.Fatalf("Ready() error = %v, want ErrDatabaseUnavailable wrapping context.Canceled", err)
		}
	case <-time.After(time.Second):
		t.Fatal("Ready() did not return after cancellation")
	}
}

// blockingProbe waits for its context to end, like a database that never answers.
type blockingProbe struct{}

func (blockingProbe) Ping(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

// TestLivenessIgnoresDependencies checks that /healthz answers while the database is down.
//
// Parameters:
//
//   - t: Go test runner used for assertions and failure reporting.
//
// Expected output:
//
//   - 200 with {"data":{"status":"OK"}} even though readiness would fail.
func TestLivenessIgnoresDependencies(t *testing.T) {
	handler := healthHandler(t, fakeReadiness{err: service.ErrDatabaseUnavailable})

	recorder := get(handler, http.MethodGet, "/healthz")

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}
	data, _ := decode(t, recorder)["data"].(map[string]any)
	if data["status"] != "OK" {
		t.Fatalf("body = %s, want data.status OK", recorder.Body.String())
	}
}

// TestReadiness checks that /readyz tells a running process from an unavailable database.
//
// Parameters:
//
//   - t: Go test runner used for subtests and assertions.
//
// Expected output:
//
//   - 200 with the success envelope when the database is reachable.
//   - 503 DEPENDENCY_UNAVAILABLE with details.dependency postgres when it is not,
//     and no driver message in the body.
//   - 500 INTERNAL_ERROR for an unexpected failure.
func TestReadiness(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		wantStatus int
		wantCode   string
	}{
		{"database reachable", nil, http.StatusOK, ""},
		{"database unavailable", errors.Join(service.ErrDatabaseUnavailable, errors.New("dial tcp 10.0.0.5: refused")), http.StatusServiceUnavailable, "DEPENDENCY_UNAVAILABLE"},
		{"unexpected failure", errors.New("boom"), http.StatusInternalServerError, "INTERNAL_ERROR"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := get(healthHandler(t, fakeReadiness{err: tt.err}), http.MethodGet, "/readyz")

			if recorder.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", recorder.Code, tt.wantStatus)
			}
			body := decode(t, recorder)
			if tt.wantCode == "" {
				if data, _ := body["data"].(map[string]any); data["status"] != "OK" {
					t.Fatalf("body = %s, want data.status OK", recorder.Body.String())
				}
				return
			}
			failure, _ := body["error"].(map[string]any)
			if failure["code"] != tt.wantCode {
				t.Fatalf("error code = %v, want %s", failure["code"], tt.wantCode)
			}
			if strings.Contains(recorder.Body.String(), "10.0.0.5") {
				t.Fatalf("body %s leaks a driver detail", recorder.Body.String())
			}
			if tt.wantCode == "DEPENDENCY_UNAVAILABLE" {
				details, _ := failure["details"].(map[string]any)
				if details["dependency"] != "postgres" {
					t.Fatalf("details = %v, want dependency postgres", details)
				}
			}
		})
	}
}

// TestUnknownRoutesUseTheErrorEnvelope checks 404 and 405 responses.
//
// Parameters:
//
//   - t: Go test runner used for subtests and assertions.
//
// Expected output:
//
//   - {"error":{"code","message","details"}} with NOT_FOUND or METHOD_NOT_ALLOWED,
//     details as an object, and an X-Request-ID response header.
func TestUnknownRoutesUseTheErrorEnvelope(t *testing.T) {
	tests := []struct {
		name, method, path, wantCode string
		wantStatus                   int
	}{
		{"unknown path", http.MethodGet, "/nope", "NOT_FOUND", http.StatusNotFound},
		{"wrong method", http.MethodPost, "/healthz", "METHOD_NOT_ALLOWED", http.StatusMethodNotAllowed},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := get(healthHandler(t, fakeReadiness{}), tt.method, tt.path)

			if recorder.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", recorder.Code, tt.wantStatus)
			}
			failure, _ := decode(t, recorder)["error"].(map[string]any)
			if failure["code"] != tt.wantCode || failure["message"] == "" {
				t.Fatalf("error = %v, want code %s and a message", failure, tt.wantCode)
			}
			if _, ok := failure["details"].(map[string]any); !ok {
				t.Fatalf("details = %v, want an object", failure["details"])
			}
			if recorder.Header().Get("X-Request-ID") == "" {
				t.Fatal("response has no X-Request-ID")
			}
		})
	}
}
