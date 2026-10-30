package unit_test

import (
	"errors"
	"net/url"
	"strings"
	"testing"

	userpostgres "github.com/melmut-42/ft_transcendence/backend/user-service/internal/repository/postgres"
)

// TestDSNWithSchema checks that connections are limited to the User Service schema.
//
// Parameters:
//
//   - t: Go test runner used for subtests and assertions.
//
// Expected output:
//
//   - search_path is users, an existing search_path is replaced, and every
//     other part of the URL is unchanged.
func TestDSNWithSchema(t *testing.T) {
	tests := []struct {
		name string
		dsn  string
	}{
		{"no query", "postgres://user:secret@db:5432/app"},
		{"keeps other parameters", "postgres://user:secret@db:5432/app?sslmode=disable&connect_timeout=3"},
		{"replaces search_path", "postgresql://user:secret@db:5432/app?search_path=public"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := userpostgres.DSNWithSchema(tt.dsn)
			if err != nil {
				t.Fatalf("DSNWithSchema() error = %v", err)
			}

			parsed, err := url.Parse(got)
			if err != nil {
				t.Fatalf("result is not a URL: %v", err)
			}
			original, _ := url.Parse(tt.dsn)
			if values := parsed.Query()["search_path"]; len(values) != 1 || values[0] != "users" {
				t.Fatalf("search_path = %v, want [users]", values)
			}
			if parsed.User.String() != original.User.String() || parsed.Host != original.Host || parsed.Path != original.Path {
				t.Fatalf("DSNWithSchema() changed credentials, host or database: %s", got)
			}
			for name, values := range original.Query() {
				if name != "search_path" && parsed.Query().Get(name) != values[0] {
					t.Fatalf("parameter %s was lost: %s", name, got)
				}
			}
		})
	}
}

// TestDSNWithSchemaRejectsInvalidURLs checks that non-PostgreSQL input is refused.
//
// Parameters:
//
//   - t: Go test runner used for subtests and assertions.
//
// Expected output:
//
//   - ErrInvalidDSN whose message never contains the supplied string.
func TestDSNWithSchemaRejectsInvalidURLs(t *testing.T) {
	for _, dsn := range []string{
		"",
		"host=localhost password=secret dbname=app",
		"mysql://user:secret@db/app",
		"postgres:///app",
		"postgres://user:secret@db:notaport/app",
	} {
		t.Run(dsn, func(t *testing.T) {
			got, err := userpostgres.DSNWithSchema(dsn)
			if !errors.Is(err, userpostgres.ErrInvalidDSN) {
				t.Fatalf("DSNWithSchema(%q) = %q, %v; want ErrInvalidDSN", dsn, got, err)
			}
			if strings.Contains(err.Error(), "secret") {
				t.Fatalf("error %q leaks the password", err)
			}
		})
	}
}
