// Package postgres manages PostgreSQL connection pools using pgx.
package postgres

import "time"

const defaultConnectTimeout = 5 * time.Second

// Config holds connection settings supplied by the application, without reading
// application environment variables. Unspecified pool options retain pgx/DSN values.
type Config struct {
	// DSN is a required PostgreSQL URL or keyword/value connection string.
	DSN string `json:"-"`

	// ConnectTimeout bounds startup and individual connection attempts; zero uses 5s.
	ConnectTimeout time.Duration

	// Positive values override the DSN; zero preserves its value or the pgx default.
	MaxConns        int32
	MinConns        int32
	MaxConnLifetime time.Duration
	MaxConnIdleTime time.Duration
}
