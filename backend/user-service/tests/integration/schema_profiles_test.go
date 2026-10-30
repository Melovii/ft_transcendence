package integration_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TestProfilesConcurrentUsernameClaims checks that names differing only in case
// or surrounding spaces cannot all be claimed.
//
// Flow:
//
//  1. Start three inserts at the same moment: "Alice", "alice" and " ALICE ".
//  2. Count successes and look at the failures.
//
// Expected output:
//
//   - Exactly one insert wins. The others fail with a unique violation on
//     profiles_username_key. One row remains.
func TestProfilesConcurrentUsernameClaims(t *testing.T) {
	pool := schemaPool(t)
	names := []string{"Alice", "alice", " ALICE "}

	var fns []func(context.Context, *pgxpool.Conn) error
	for i, name := range names {
		id := int64(i + 1)
		fns = append(fns, func(ctx context.Context, conn *pgxpool.Conn) error {
			_, err := conn.Exec(ctx, "INSERT INTO profiles (user_id, username) VALUES ($1, $2)", id, name)

			return err
		})
	}
	results := race(t, pool, fns...)

	if got := countSuccesses(results); got != 1 {
		t.Fatalf("%d inserts won, want exactly 1", got)
	}
	for _, r := range results {
		if r.err != nil {
			wantViolation(t, r.err, codeUnique, "profiles_username_key")
		}
	}
	if got := count(t, pool, "SELECT count(*) FROM profiles"); got != 1 {
		t.Fatalf("%d profiles stored, want 1", got)
	}
}

// TestProfilesUsernameUniquenessSequential checks the same rule without a race,
// so a failure here points at the index and not at timing.
func TestProfilesUsernameUniquenessSequential(t *testing.T) {
	pool := schemaPool(t)
	mustExec(t, pool, "INSERT INTO profiles (user_id, username) VALUES (1, 'Alice')")

	for _, name := range []string{"alice", "ALICE", "  alice", "Alice  ", " aLiCe "} {
		err := exec(pool, "INSERT INTO profiles (user_id, username) VALUES (2, $1)", name)
		wantViolation(t, err, codeUnique, "profiles_username_key")
	}
	mustExec(t, pool, "INSERT INTO profiles (user_id, username) VALUES (2, 'alice_2')")
}

// TestProfilesOnePerUserID checks that a user_id has at most one profile, even
// under a different username.
func TestProfilesOnePerUserID(t *testing.T) {
	pool := schemaPool(t)
	mustExec(t, pool, "INSERT INTO profiles (user_id, username) VALUES (7, 'first_name')")

	err := exec(pool, "INSERT INTO profiles (user_id, username) VALUES (7, 'second_name')")

	wantViolation(t, err, codeUnique, "profiles_pkey")
}

// TestProfilesRejectBadRows checks the profile CHECK constraints.
func TestProfilesRejectBadRows(t *testing.T) {
	pool := schemaPool(t)
	tests := []struct {
		name       string
		userID     int64
		username   string
		constraint string // any of these, separated by space
	}{
		{"zero id", 0, "valid_name", "profiles_user_id_positive"},
		{"negative id", -5, "valid_name", "profiles_user_id_positive"},
		{"blank username", 1, "   ", "profiles_username_not_blank profiles_username_length profiles_username_chars"},
		{"empty username", 1, "", "profiles_username_not_blank profiles_username_length profiles_username_chars"},
		{"too short", 1, "ab", "profiles_username_length"},
		{"too long", 1, strings.Repeat("a", 21), "profiles_username_length"},
		{"bad characters", 1, "bad-name", "profiles_username_chars"},
		{"inner space", 1, "bad name", "profiles_username_chars"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := exec(pool, "INSERT INTO profiles (user_id, username) VALUES ($1, $2)", tt.userID, tt.username)
			// PostgreSQL reports the first failing CHECK in name order, so a blank
			// name may be reported by a sibling rule. Any of the listed ones is right.
			var pgErr *pgconn.PgError
			if !errors.As(err, &pgErr) || pgErr.Code != codeCheck || !strings.Contains(tt.constraint, pgErr.ConstraintName) {
				t.Fatalf("error = %v, want a CHECK violation of one of: %s", err, tt.constraint)
			}
		})
	}
}

// TestProfilesAvatarReference checks that avatar_kind and avatar_ref agree.
func TestProfilesAvatarReference(t *testing.T) {
	pool := schemaPool(t)
	good := []struct{ kind, ref string }{
		{"default", ""}, {"preset", "scholar-owl"}, {"upload", "avatars/42.webp"},
	}
	for i, g := range good {
		id := int64(i + 1)
		if g.ref == "" {
			mustExec(t, pool, "INSERT INTO profiles (user_id, username, avatar_kind) VALUES ($1, $2, $3)", id, "good_"+g.kind, g.kind)
		} else {
			mustExec(t, pool, "INSERT INTO profiles (user_id, username, avatar_kind, avatar_ref) VALUES ($1, $2, $3, $4)", id, "good_"+g.kind, g.kind, g.ref)
		}
	}

	err := exec(pool, "INSERT INTO profiles (user_id, username, avatar_kind, avatar_ref) VALUES (10, 'bad_one', 'default', 'x')")
	wantViolation(t, err, codeCheck, "profiles_avatar_ref_matches_kind")
	err = exec(pool, "INSERT INTO profiles (user_id, username, avatar_kind) VALUES (11, 'bad_two', 'preset')")
	wantViolation(t, err, codeCheck, "profiles_avatar_ref_matches_kind")
	err = exec(pool, "INSERT INTO profiles (user_id, username, avatar_kind) VALUES (12, 'bad_three', 'gif')")
	wantViolation(t, err, codeCheck, "profiles_avatar_kind_valid")
}

// TestProfilesUpdatedAtMoves checks the updated_at trigger.
func TestProfilesUpdatedAtMoves(t *testing.T) {
	pool := schemaPool(t)
	seedProfiles(t, pool, 1)

	mustExec(t, pool, "UPDATE profiles SET username = 'renamed' WHERE user_id = 1")

	if got := count(t, pool, "SELECT count(*) FROM profiles WHERE updated_at > created_at"); got != 1 {
		t.Fatalf("updated_at did not move after UPDATE")
	}
}
