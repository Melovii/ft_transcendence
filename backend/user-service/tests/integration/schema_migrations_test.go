package integration_test

import (
	"context"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"
	userpostgres "github.com/melmut-42/ft_transcendence/backend/user-service/internal/repository/postgres"
	"github.com/melmut-42/ft_transcendence/backend/user-service/migrations"
)

// TestMigrationsUpAndDownAreClean checks every down file against an empty database.
//
// Flow:
//
//  1. Migrate up and note the objects in the users schema.
//  2. Step down one migration at a time, all the way to version 1.
//  3. Check nothing but the version table and the empty baseline is left.
//  4. Migrate up again and check the same objects return.
//
// Expected output:
//
//   - No step fails or leaves the version table dirty, and the second climb
//     recreates exactly what the first did.
func TestMigrationsUpAndDownAreClean(t *testing.T) {
	dsn := freshDatabase(t)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	if err := userpostgres.Migrate(ctx, dsn); err != nil {
		t.Fatalf("Migrate() error = %v", err)
	}
	pool := openPool(t, dsn)
	before := schemaObjects(t, pool)
	if len(before) == 0 {
		t.Fatal("migrations created no objects")
	}

	scoped, err := userpostgres.DSNWithSchema(dsn)
	if err != nil {
		t.Fatal(err)
	}
	source, err := iofs.New(migrations.Files, ".")
	if err != nil {
		t.Fatal(err)
	}
	runner, err := migrate.NewWithSourceInstance("iofs", source, "pgx5"+scoped[len("postgres"):])
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = runner.Close() }()

	for version := latestMigration; version > 1; version-- {
		if err := runner.Steps(-1); err != nil {
			t.Fatalf("down from version %d: %v", version, err)
		}
	}
	if got := queryString(t, pool, "SELECT version::text || ' ' || dirty::text FROM users.schema_migrations"); got != "1 false" {
		t.Fatalf("schema_migrations after down = %q, want \"1 false\"", got)
	}
	if left := schemaObjects(t, pool); len(left) != 0 {
		t.Fatalf("objects left after down: %v", left)
	}

	if err := userpostgres.Migrate(ctx, dsn); err != nil {
		t.Fatalf("Migrate() after down error = %v", err)
	}
	after := schemaObjects(t, pool)
	if len(after) != len(before) {
		t.Fatalf("objects after second climb = %d, want %d", len(after), len(before))
	}
	for i := range before {
		if before[i] != after[i] {
			t.Fatalf("object %d differs: %q then %q", i, before[i], after[i])
		}
	}
}

// schemaObjects lists relations and functions in the users schema except the
// migration version table and its indexes, sorted for comparison.
func schemaObjects(t *testing.T, pool *pgxpool.Pool) []string {
	t.Helper()
	rows, err := pool.Query(context.Background(), `
		SELECT c.relkind::text || ':' || c.relname
		FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'users'
		  AND c.relname <> 'schema_migrations'
		  AND NOT EXISTS (SELECT 1 FROM pg_index i
		                  WHERE i.indexrelid = c.oid AND i.indrelid = 'users.schema_migrations'::regclass)
		UNION ALL
		SELECT 'f:' || p.proname
		FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = 'users'
		ORDER BY 1`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatal(err)
		}
		out = append(out, name)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}

	return out
}
