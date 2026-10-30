package integration_test

import (
	"context"
	"crypto/rand"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/melmut-42/ft_transcendence/backend/user-service/internal/controller"
	userpostgres "github.com/melmut-42/ft_transcendence/backend/user-service/internal/repository/postgres"
	"github.com/melmut-42/ft_transcendence/backend/user-service/internal/server"
	"github.com/melmut-42/ft_transcendence/backend/user-service/internal/service"
)

// freshDatabase creates an empty, isolated database and returns its URL.
//
// Parameters:
//
//   - t: Go test runner; the database is dropped when the test ends.
//
// Inputs:
//
//   - USER_TEST_DATABASE_URL pointing to a PostgreSQL server where the role may
//     create and drop databases. The database named in it is only used to connect.
//
// Flow:
//
//  1. Skip the test if the variable is unset.
//  2. Create a database with a random name through the administrative connection.
//  3. Register cleanup that drops it, forcing out any connection still open.
//
// Expected output:
//
//   - A postgres:// URL for a brand-new database containing no schemas except the defaults.
func freshDatabase(t *testing.T) string {
	t.Helper()
	adminURL := os.Getenv("USER_TEST_DATABASE_URL")
	if adminURL == "" {
		t.Skip("set USER_TEST_DATABASE_URL to run PostgreSQL integration tests")
	}

	ctx := context.Background()
	admin, err := pgx.Connect(ctx, adminURL)
	if err != nil {
		t.Fatalf("connect to USER_TEST_DATABASE_URL: %v", sanitize(err, adminURL))
	}
	t.Cleanup(func() { _ = admin.Close(ctx) })

	name := "user_service_test_" + strings.ToLower(rand.Text())
	quoted := pgx.Identifier{name}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+quoted); err != nil {
		t.Fatalf("create test database: %v", err)
	}
	t.Cleanup(func() {
		_, _ = admin.Exec(context.Background(), "DROP DATABASE IF EXISTS "+quoted+" WITH (FORCE)")
	})

	parsed, err := url.Parse(adminURL)
	if err != nil {
		t.Fatalf("parse USER_TEST_DATABASE_URL: %v", sanitize(err, adminURL))
	}
	parsed.Path = "/" + name

	return parsed.String()
}

// sanitize removes the connection string from an error before it is printed.
func sanitize(err error, secret string) string {
	return strings.ReplaceAll(err.Error(), secret, "[redacted]")
}

// openPool opens a schema-scoped pool and closes it when the test ends.
//
// Parameters:
//
//   - t: Go test runner used to report setup failures.
//   - dsn: URL of a database that has already been migrated.
//
// Expected output:
//
//   - A ready pool whose connections use only the users schema.
func openPool(t *testing.T, dsn string) *pgxpool.Pool {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := userpostgres.OpenPool(ctx, dsn)
	if err != nil {
		t.Fatalf("OpenPool() error = %v", err)
	}
	t.Cleanup(pool.Close)

	return pool
}

// healthHandler assembles the real layers around a pool, without opening a listener.
//
// Parameters:
//
//   - t: Go test runner; Gin is put in test mode.
//   - pool: Pool probed by GET /readyz.
//
// Expected output:
//
//   - The server's handler wired exactly like cmd/server wires it.
func healthHandler(t *testing.T, pool *pgxpool.Pool) http.Handler {
	t.Helper()
	gin.SetMode(gin.TestMode)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	health := controller.NewHealth(service.NewHealth(userpostgres.NewHealth(pool)))

	return server.New("0", health, logger).Handler
}

// request dispatches one request in memory and returns the recorded response.
func request(handler http.Handler, method, path string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(method, path, nil))

	return recorder
}
