package integration_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	userpostgres "github.com/melmut-42/ft_transcendence/backend/user-service/internal/repository/postgres"
)

// TestReadinessFollowsTheDatabase checks the readiness endpoint against real PostgreSQL.
//
// Parameters:
//
//   - t: Go test runner used for assertions and failure reporting.
//
// Inputs:
//
//   - USER_TEST_DATABASE_URL; the test is skipped without it.
//
// Flow:
//
//  1. Migrate an empty database, open the pool and build the real handler.
//  2. Call /readyz and /healthz while the pool works.
//  3. Close the pool, which stands in for an unavailable database, and call both again.
//
// Expected output:
//
//   - 200 for both endpoints while the database works.
//   - After it is gone, /healthz stays 200 and /readyz returns 503 DEPENDENCY_UNAVAILABLE.
func TestReadinessFollowsTheDatabase(t *testing.T) {
	dsn := freshDatabase(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := userpostgres.Migrate(ctx, dsn); err != nil {
		t.Fatalf("Migrate() error = %v", err)
	}
	pool := openPool(t, dsn)
	handler := healthHandler(t, pool)

	for _, path := range []string{"/readyz", "/healthz"} {
		if recorder := request(handler, http.MethodGet, path); recorder.Code != http.StatusOK {
			t.Fatalf("GET %s = %d, want 200 while the database works", path, recorder.Code)
		}
	}

	pool.Close()

	if recorder := request(handler, http.MethodGet, "/healthz"); recorder.Code != http.StatusOK {
		t.Fatalf("GET /healthz = %d, want 200 even without a database", recorder.Code)
	}
	recorder := request(handler, http.MethodGet, "/readyz")
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("GET /readyz = %d, want 503 without a database", recorder.Code)
	}
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil || body.Error.Code != "DEPENDENCY_UNAVAILABLE" {
		t.Fatalf("body = %s, want DEPENDENCY_UNAVAILABLE", recorder.Body.String())
	}
}
