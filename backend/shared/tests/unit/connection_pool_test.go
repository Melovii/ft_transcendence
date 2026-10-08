package unit_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/melmut-42/ft_transcendence/backend/shared/postgres"
)

const testDSN = "postgres://test_user:private-password@127.0.0.1/test_db?sslmode=disable"

// TestPoolConfigDefaults checks connection and pool defaults without connecting.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - Config containing only testDSN.
//
// Flow:
//
//  1. Call postgres.PoolConfig and compare the generated settings.
//
// Expected output:
//
//   - nil error; connect timeout=5s, MaxConns>=4, MinConns=0, lifetime=1h and idle time=30m.
func TestPoolConfigDefaults(t *testing.T) {
	cfg, err := postgres.PoolConfig(postgres.Config{DSN: testDSN})
	if err != nil {
		t.Fatal(err)
	}

	if cfg.ConnConfig.ConnectTimeout != 5*time.Second || cfg.MaxConns < 4 || cfg.MinConns != 0 ||
		cfg.MaxConnLifetime != time.Hour || cfg.MaxConnIdleTime != 30*time.Minute {
		t.Fatal("unexpected default pool settings")
	}
}

// TestPoolConfigOverrides checks DSN settings and explicit override precedence.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - DSN pool settings: max=8, min=2, lifetime=2h and idle time=10m.
//   - An optional explicit override: timeout=2s, max=6, min=1, lifetime=1h and idle time=5m.
//
// Flow:
//
//  1. Build pool configuration for DSN-only and override cases.
//  2. Compare each timeout, size and lifetime against its case expectation.
//
// Expected output:
//
//   - DSN-only settings are retained with a 5s timeout.
//   - Nonzero Config fields override DSN values; both cases return nil errors.
func TestPoolConfigOverrides(t *testing.T) {
	tests := poolOverrideCases()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg, err := postgres.PoolConfig(tt.config)
			if err != nil {
				t.Fatal(err)
			}

			if cfg.ConnConfig.ConnectTimeout != tt.timeout || cfg.MaxConns != tt.max || cfg.MinConns != tt.min ||
				cfg.MaxConnLifetime != tt.life || cfg.MaxConnIdleTime != tt.idle {
				t.Fatal("pool settings did not respect configuration precedence")
			}
		})
	}
}

// TestOpenInvalidConfig checks validation errors and credential-safe messages.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - Missing/blank/malformed DSNs; negative durations and pool counts; inconsistent bounds.
//   - Invalid DSN pool parameters including health interval, jitter and ping timeout.
//
// Flow:
//
//  1. Call Open with a background context for every invalid configuration.
//  2. Check the pool result, error classification and message.
//
// Expected output:
//
//   - Every case returns a nil pool and an error matching ErrInvalidConfig.
//   - Errors contain neither the test username nor the test password.
func TestOpenInvalidConfig(t *testing.T) {
	tests := invalidPoolCases()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pool, err := postgres.Open(context.Background(), tt.config)
			if pool != nil {
				pool.Close()
				t.Fatal("invalid config returned a pool")
			}

			if !errors.Is(err, postgres.ErrInvalidConfig) {
				t.Fatalf("expected ErrInvalidConfig, got %v", err)
			}

			if strings.Contains(err.Error(), "private-password") || strings.Contains(err.Error(), "test_user") {
				t.Fatal("configuration error exposed credentials")
			}
		})
	}
}

// TestOpenContext checks already canceled or expired startup contexts.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - An already canceled context and an already expired deadline, each with a valid testDSN.
//
// Flow:
//
//  1. Call Open with each context.
//  2. Check that no pool is returned and compare wrapped errors using errors.Is.
//
// Expected output:
//
//   - A nil pool and an error matching ErrConnect plus context.Canceled or
//     context.DeadlineExceeded.
func TestOpenContext(t *testing.T) {
	canceled, cancel := context.WithCancel(context.Background())
	cancel()

	expired, release := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer release()

	tests := []struct {
		name string
		ctx  context.Context
		want error
	}{
		{"canceled", canceled, context.Canceled},
		{"expired", expired, context.DeadlineExceeded},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pool, err := postgres.Open(tt.ctx, postgres.Config{DSN: testDSN})
			if pool != nil {
				pool.Close()
				t.Fatal("canceled startup returned a pool")
			}

			if !errors.Is(err, postgres.ErrConnect) || !errors.Is(err, tt.want) {
				t.Fatalf("expected ErrConnect and %v, got %v", tt.want, err)
			}
		})
	}
}

type poolOverrideCase struct {
	name    string
	config  postgres.Config
	timeout time.Duration
	max     int32
	min     int32
	life    time.Duration
	idle    time.Duration
}

func poolOverrideCases() []poolOverrideCase {
	dsn := testDSN + "&pool_max_conns=8&pool_min_conns=2&pool_max_conn_lifetime=2h&pool_max_conn_idle_time=10m"
	return []poolOverrideCase{
		{
			name: "DSN settings", config: postgres.Config{DSN: dsn},
			timeout: 5 * time.Second, max: 8, min: 2, life: 2 * time.Hour, idle: 10 * time.Minute,
		},
		{
			name: "explicit overrides", config: postgres.Config{
				DSN: dsn, ConnectTimeout: 2 * time.Second, MaxConns: 6, MinConns: 1,
				MaxConnLifetime: time.Hour, MaxConnIdleTime: 5 * time.Minute,
			},
			timeout: 2 * time.Second, max: 6, min: 1, life: time.Hour, idle: 5 * time.Minute,
		},
	}
}

type invalidPoolCase struct {
	name   string
	config postgres.Config
}

func invalidPoolCases() []invalidPoolCase {
	return []invalidPoolCase{
		{"missing DSN", postgres.Config{}},
		{"blank DSN", postgres.Config{DSN: "  "}},
		{"malformed DSN", postgres.Config{DSN: "postgres://test_user:private-password@localhost:invalid/db"}},
		{"negative timeout", postgres.Config{DSN: testDSN, ConnectTimeout: -time.Second}},
		{"negative maximum", postgres.Config{DSN: testDSN, MaxConns: -1}},
		{"negative minimum", postgres.Config{DSN: testDSN, MinConns: -1}},
		{"negative lifetime", postgres.Config{DSN: testDSN, MaxConnLifetime: -time.Second}},
		{"negative idle time", postgres.Config{DSN: testDSN, MaxConnIdleTime: -time.Second}},
		{"minimum exceeds maximum", postgres.Config{DSN: testDSN, MaxConns: 1, MinConns: 2}},
		{"DSN minimum exceeds override", postgres.Config{DSN: testDSN + "&pool_min_conns=3", MaxConns: 2}},
		{"DSN negative minimum", postgres.Config{DSN: testDSN + "&pool_min_conns=-1"}},
		{"DSN zero maximum", postgres.Config{DSN: testDSN + "&pool_max_conns=0"}},
		{"DSN negative idle minimum", postgres.Config{DSN: testDSN + "&pool_min_idle_conns=-1"}},
		{"DSN idle minimum exceeds maximum", postgres.Config{DSN: testDSN + "&pool_min_idle_conns=3", MaxConns: 2}},
		{"DSN zero lifetime", postgres.Config{DSN: testDSN + "&pool_max_conn_lifetime=0"}},
		{"DSN negative idle time", postgres.Config{DSN: testDSN + "&pool_max_conn_idle_time=-1s"}},
		{"DSN zero health interval", postgres.Config{DSN: testDSN + "&pool_health_check_period=0"}},
		{"DSN negative jitter", postgres.Config{DSN: testDSN + "&pool_max_conn_lifetime_jitter=-1s"}},
		{"DSN negative ping timeout", postgres.Config{DSN: testDSN + "&pool_ping_timeout=-1s"}},
	}
}
