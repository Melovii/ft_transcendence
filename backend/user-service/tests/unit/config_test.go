package unit_test

import (
	"strings"
	"testing"

	"github.com/melmut-42/ft_transcendence/backend/user-service/internal/config"
)

const validDatabaseURL = "postgres://user:secret@localhost:5432/user?sslmode=disable"

// setEnvironment replaces every setting config.Load reads.
//
// Parameters:
//
//   - t: Go test runner; values are restored when the test ends.
//   - values: Setting names and values; names missing here are set to empty.
func setEnvironment(t *testing.T, values map[string]string) {
	t.Helper()
	for _, name := range []string{"APP_ENV", "LOG_FORMAT", "LOG_LEVEL", "PORT", "DATABASE_URL", "MIGRATE_ON_START"} {
		t.Setenv(name, values[name])
	}
}

// TestLoadDefaults checks the defaults applied when only DATABASE_URL is supplied.
//
// Parameters:
//
//   - t: Go test runner used for assertions and failure reporting.
//
// Expected output:
//
//   - Development environment, port 8080, text logs at debug level, migrations on.
func TestLoadDefaults(t *testing.T) {
	setEnvironment(t, map[string]string{"DATABASE_URL": validDatabaseURL})

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Environment != "development" || cfg.Port != "8080" || cfg.LogFormat != "text" ||
		cfg.LogLevel != "debug" || !cfg.MigrateOnStart || cfg.DatabaseURL != validDatabaseURL {
		t.Fatalf("Load() = %+v, want development defaults", cfg)
	}
}

// TestLoadEnvironmentDefaults checks logging defaults for production and test.
//
// Parameters:
//
//   - t: Go test runner used for subtests and assertions.
//
// Expected output:
//
//   - Production logs JSON at info; test logs text at error.
func TestLoadEnvironmentDefaults(t *testing.T) {
	tests := []struct {
		environment, format, level string
	}{
		{"production", "json", "info"},
		{"test", "text", "error"},
	}
	for _, tt := range tests {
		t.Run(tt.environment, func(t *testing.T) {
			setEnvironment(t, map[string]string{"APP_ENV": tt.environment, "DATABASE_URL": validDatabaseURL})

			cfg, err := config.Load()
			if err != nil {
				t.Fatalf("Load() error = %v", err)
			}
			if cfg.LogFormat != tt.format || cfg.LogLevel != tt.level {
				t.Fatalf("logging = %s/%s, want %s/%s", cfg.LogFormat, cfg.LogLevel, tt.format, tt.level)
			}
		})
	}
}

// TestLoadMigrateOnStart checks that MIGRATE_ON_START can switch migrations off.
//
// Parameters:
//
//   - t: Go test runner used for subtests and assertions.
//
// Expected output:
//
//   - "false" disables migrations, "true" keeps them, other values are rejected.
func TestLoadMigrateOnStart(t *testing.T) {
	tests := []struct {
		value   string
		want    bool
		wantErr bool
	}{
		{"false", false, false},
		{"true", true, false},
		{"maybe", false, true},
	}
	for _, tt := range tests {
		t.Run(tt.value, func(t *testing.T) {
			setEnvironment(t, map[string]string{"DATABASE_URL": validDatabaseURL, "MIGRATE_ON_START": tt.value})

			cfg, err := config.Load()
			if (err != nil) != tt.wantErr {
				t.Fatalf("Load() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err == nil && cfg.MigrateOnStart != tt.want {
				t.Fatalf("MigrateOnStart = %v, want %v", cfg.MigrateOnStart, tt.want)
			}
		})
	}
}

// TestLoadRejectsInvalidSettings checks startup validation failures.
//
// Parameters:
//
//   - t: Go test runner used for subtests and assertions.
//
// Expected output:
//
//   - A zero Config and an error naming the offending setting, never the database password.
func TestLoadRejectsInvalidSettings(t *testing.T) {
	tests := []struct {
		name   string
		values map[string]string
		want   string
	}{
		{"missing database url", map[string]string{}, "DATABASE_URL is required"},
		{"not a postgres url", map[string]string{"DATABASE_URL": "mysql://user:secret@localhost/db"}, "postgres://"},
		{"url without host", map[string]string{"DATABASE_URL": "postgres:///db"}, "postgres://"},
		{"port not a number", map[string]string{"DATABASE_URL": validDatabaseURL, "PORT": "http"}, "PORT"},
		{"port too large", map[string]string{"DATABASE_URL": validDatabaseURL, "PORT": "70000"}, "PORT"},
		{"unknown environment", map[string]string{"DATABASE_URL": validDatabaseURL, "APP_ENV": "staging"}, "APP_ENV"},
		{"unknown log format", map[string]string{"DATABASE_URL": validDatabaseURL, "LOG_FORMAT": "xml"}, "LOG_FORMAT"},
		{"unknown log level", map[string]string{"DATABASE_URL": validDatabaseURL, "LOG_LEVEL": "loud"}, "LOG_LEVEL"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setEnvironment(t, tt.values)

			cfg, err := config.Load()
			if err == nil {
				t.Fatalf("Load() = %+v, want error", cfg)
			}
			if !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("error = %q, want it to mention %q", err, tt.want)
			}
			if strings.Contains(err.Error(), "secret") {
				t.Fatalf("error %q leaks the database password", err)
			}
		})
	}
}
