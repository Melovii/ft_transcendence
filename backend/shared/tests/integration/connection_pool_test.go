package integration_test

import (
	"context"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"net"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/melmut-42/ft_transcendence/backend/shared/postgres"
)

// TestOpenTimeout checks bounded startup against an unresponsive TCP listener.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - A local TCP listener that does not complete a PostgreSQL handshake.
//   - ConnectTimeout=50ms and MaxConns=1.
//
// Flow:
//
//  1. Start the listener, build its DSN and record the start time.
//  2. Call Open and inspect the result and elapsed time; close the listener afterward.
//
// Expected output:
//
//   - A nil pool and an error matching ErrConnect and context.DeadlineExceeded.
//   - The attempt completes within the test tolerance of 2 seconds.
func TestOpenTimeout(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()

	dsn := fmt.Sprintf("postgres://test_user:private-password@%s/test_db?sslmode=disable", listener.Addr())
	started := time.Now()
	pool, err := postgres.Open(context.Background(), postgres.Config{DSN: dsn, ConnectTimeout: 50 * time.Millisecond, MaxConns: 1})
	if pool != nil {
		pool.Close()
		t.Fatal("unresponsive server returned a pool")
	}

	if !errors.Is(err, postgres.ErrConnect) || !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected connection timeout, got %v", err)
	}

	if time.Since(started) > 2*time.Second {
		t.Fatal("startup did not honor its connection timeout")
	}
}

// TestOpenUnavailable checks connection failures without exposing DSN credentials.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - A PostgreSQL Unix-socket DSN pointing to an empty temporary directory.
//   - ConnectTimeout=1s with a test username and password.
//
// Flow:
//
//  1. Call Open against the absent server.
//  2. Check the returned pool, error class and error text.
//
// Expected output:
//
//   - A nil pool and an error matching ErrConnect.
//   - The error message includes neither the username nor the password.
func TestOpenUnavailable(t *testing.T) {
	dsn := fmt.Sprintf("host=%s user=test_user password=private-password dbname=test_db sslmode=disable", t.TempDir())
	pool, err := postgres.Open(context.Background(), postgres.Config{DSN: dsn, ConnectTimeout: time.Second})
	if pool != nil {
		pool.Close()
		t.Fatal("missing server returned a pool")
	}

	if !errors.Is(err, postgres.ErrConnect) {
		t.Fatalf("expected ErrConnect, got %v", err)
	}

	if strings.Contains(err.Error(), "private-password") || strings.Contains(err.Error(), "test_user") {
		t.Fatal("connection error exposed credentials")
	}
}

// TestOpenPostgres checks real pool connectivity, lifetime and cleanup.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - POSTGRES_TEST_DATABASE_URL and MaxConns=2.
//   - A cancelable startup context and a separate 5s query context.
//
// Flow:
//
//  1. Skip if the database URL is unset; otherwise Open the pool, then cancel the startup
//     context.
//  2. Run SELECT 1 using the fresh query context and inspect the pool maximum.
//  3. Close the pool and attempt to ping it again.
//
// Expected output:
//
//   - SELECT 1 returns integer 1 after startup cancellation; pool maximum is 2.
//   - Ping fails after Close; no application data is created or modified.
func TestOpenPostgres(t *testing.T) {
	dsn := os.Getenv("POSTGRES_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("POSTGRES_TEST_DATABASE_URL is not set")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pool, err := postgres.Open(ctx, postgres.Config{DSN: dsn, MaxConns: 2})
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	cancel()

	checkPoolAfterStartup(t, pool)

	pool.Close()
	if err := pool.Ping(context.Background()); err == nil {
		t.Fatal("closed pool still accepts queries")
	}
}

func checkPoolAfterStartup(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	queryCtx, queryCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer queryCancel()

	var value int
	if err := pool.QueryRow(queryCtx, "SELECT 1").Scan(&value); err != nil || value != 1 {
		t.Fatalf("pool is not usable after startup: value=%d err=%v", value, err)
	}

	if pool.Stat().MaxConns() != 2 {
		t.Fatal("pool did not apply the configured maximum")
	}
}
