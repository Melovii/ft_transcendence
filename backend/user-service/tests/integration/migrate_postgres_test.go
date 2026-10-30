package integration_test

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	userpostgres "github.com/melmut-42/ft_transcendence/backend/user-service/internal/repository/postgres"
)

// queryString runs a single-value query and returns the result as a string.
func queryString(t *testing.T, pool *pgxpool.Pool, sql string) string {
	t.Helper()
	var value string
	if err := pool.QueryRow(context.Background(), sql).Scan(&value); err != nil {
		t.Fatalf("query %q: %v", sql, err)
	}

	return value
}

// TestMigrateEmptyDatabase checks that the service can bring an empty database up to date.
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
//  1. Create an empty database and run Migrate.
//  2. Check the users schema exists and the version table records the latest version as clean.
//  3. Run Migrate again to confirm nothing pending is not an error.
//
// Expected output:
//
//   - Both runs succeed, and the version stays at the latest and not dirty.
func TestMigrateEmptyDatabase(t *testing.T) {
	dsn := freshDatabase(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	for run := 1; run <= 2; run++ {
		if err := userpostgres.Migrate(ctx, dsn); err != nil {
			t.Fatalf("Migrate() run %d error = %v", run, err)
		}
	}

	pool := openPool(t, dsn)
	if got := queryString(t, pool, "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'users'"); got != "users" {
		t.Fatalf("schema = %q, want users", got)
	}
	if got := queryString(t, pool, "SELECT version::text || ' ' || dirty::text FROM users.schema_migrations"); got != fmt.Sprintf("%d false", latestMigration) {
		t.Fatalf("schema_migrations = %q, want latest version %d, clean", got, latestMigration)
	}
}

// TestMigrateKeepsToItsOwnSchema checks that the service never writes to another schema.
//
// Parameters:
//
//   - t: Go test runner used for assertions and failure reporting.
//
// Flow:
//
//  1. Migrate an empty database.
//  2. List every relation outside system schemas.
//
// Expected output:
//
//   - Every table belongs to the users schema; public holds nothing.
func TestMigrateKeepsToItsOwnSchema(t *testing.T) {
	dsn := freshDatabase(t)
	if err := userpostgres.Migrate(context.Background(), dsn); err != nil {
		t.Fatalf("Migrate() error = %v", err)
	}

	pool := openPool(t, dsn)
	var outside int
	err := pool.QueryRow(context.Background(), `
		SELECT count(*) FROM information_schema.tables
		WHERE table_schema NOT IN ('users', 'pg_catalog', 'information_schema')`).Scan(&outside)
	if err != nil {
		t.Fatal(err)
	}
	if outside != 0 {
		t.Fatalf("%d tables exist outside the users schema", outside)
	}
	if got := queryString(t, pool, "SELECT current_schema()"); got != "users" {
		t.Fatalf("current_schema() = %q, want users", got)
	}
}

// TestMigrateConcurrentStarts checks that several instances starting together are safe.
//
// Parameters:
//
//   - t: Go test runner used for assertions and failure reporting.
//
// Flow:
//
//  1. Start Migrate from several goroutines against one empty database.
//  2. Wait for all of them.
//
// Expected output:
//
//   - Every call succeeds and the version table holds exactly one clean row.
func TestMigrateConcurrentStarts(t *testing.T) {
	dsn := freshDatabase(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	const instances = 5
	errs := make(chan error, instances)
	var wg sync.WaitGroup
	for range instances {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errs <- userpostgres.Migrate(ctx, dsn)
		}()
	}
	wg.Wait()
	close(errs)

	for err := range errs {
		if err != nil {
			t.Fatalf("concurrent Migrate() error = %v", err)
		}
	}
	pool := openPool(t, dsn)
	if got := queryString(t, pool, "SELECT count(*)::text || ' ' || bool_or(dirty)::text FROM users.schema_migrations"); got != "1 false" {
		t.Fatalf("schema_migrations = %q, want one clean row", got)
	}
}

// TestMigrateStopsOnCanceledContext checks that a canceled startup does not migrate.
//
// Parameters:
//
//   - t: Go test runner used for assertions and failure reporting.
//
// Expected output:
//
//   - An error wrapping context.Canceled.
func TestMigrateStopsOnCanceledContext(t *testing.T) {
	dsn := freshDatabase(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err := userpostgres.Migrate(ctx, dsn)

	if !errors.Is(err, context.Canceled) {
		t.Fatalf("Migrate() error = %v, want context.Canceled", err)
	}
}

// TestMigrateUnreachableDatabase checks the failure when PostgreSQL cannot be reached.
//
// Parameters:
//
//   - t: Go test runner used for assertions and failure reporting.
//
// Expected output:
//
//   - An error that does not contain the password from the connection string.
func TestMigrateUnreachableDatabase(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err := userpostgres.Migrate(ctx, "postgres://user:hunter2@127.0.0.1:1/user?sslmode=disable&connect_timeout=1")

	if err == nil {
		t.Fatal("Migrate() succeeded against an unreachable database")
	}
	if strings.Contains(err.Error(), "hunter2") {
		t.Fatalf("error %q leaks the password", err)
	}
}
