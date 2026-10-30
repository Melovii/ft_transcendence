package integration_test

import (
	"strings"
	"testing"
)

// TestOperationTables checks provisioning_operations and deletion_operations,
// which share one shape. Each table is run through the same cases.
//
// Expected output:
//
//   - A retried insert with the same operation id does nothing (idempotent).
//   - A second operation id for the same user is refused.
//   - Bad ids, states, attempts and a completed state without a time are refused.
func TestOperationTables(t *testing.T) {
	tables := []struct{ table, prefix string }{
		{"provisioning_operations", "provisioning"},
		{"deletion_operations", "deletion"},
	}
	for _, tb := range tables {
		t.Run(tb.table, func(t *testing.T) {
			pool := schemaPool(t)
			const op = "11111111-1111-1111-1111-111111111111"
			insert := "INSERT INTO " + tb.table + " (operation_id, user_id) VALUES ($1, $2)"

			mustExec(t, pool, insert, op, 42)
			mustExec(t, pool, insert+" ON CONFLICT (operation_id) DO NOTHING", op, 42)
			if got := count(t, pool, "SELECT count(*) FROM "+tb.table); got != 1 {
				t.Fatalf("%d rows after a retried insert, want 1", got)
			}

			wantViolation(t, exec(pool, insert, op, 42), codeUnique, tb.table+"_pkey")
			wantViolation(t, exec(pool, insert, "22222222-2222-2222-2222-222222222222", 42), codeUnique, tb.table+"_user_key")
			wantViolation(t, exec(pool, insert, "33333333-3333-3333-3333-333333333333", 0), codeCheck, tb.prefix+"_user_id_positive")

			update := func(set string) error {
				return exec(pool, "UPDATE "+tb.table+" SET "+set+" WHERE user_id = 42")
			}
			wantViolation(t, update("state = 'stuck'"), codeCheck, tb.prefix+"_state_valid")
			wantViolation(t, update("attempts = -1"), codeCheck, tb.prefix+"_attempts_nonnegative")
			wantViolation(t, update("state = 'completed'"), codeCheck, tb.prefix+"_completed_matches_state")
			wantViolation(t, update("completed_at = now()"), codeCheck, tb.prefix+"_completed_matches_state")
			wantViolation(t, update("last_error = '"+strings.Repeat("e", 2001)+"'"), codeCheck, tb.prefix+"_last_error_length")

			mustExec(t, pool, "UPDATE "+tb.table+" SET state = 'failed', attempts = attempts + 1, last_error = 'upstream down' WHERE user_id = 42")
			mustExec(t, pool, "UPDATE "+tb.table+" SET state = 'completed', completed_at = now() WHERE user_id = 42")
			if got := count(t, pool, "SELECT count(*) FROM "+tb.table+" WHERE attempts = 1 AND updated_at > created_at"); got != 1 {
				t.Fatal("attempts or updated_at were not recorded")
			}
		})
	}
}

// TestOperationsKeepNoProfileLink checks that operations need no profile, so a
// deletion record can outlive the profile it removed.
func TestOperationsKeepNoProfileLink(t *testing.T) {
	pool := schemaPool(t)

	mustExec(t, pool, "INSERT INTO deletion_operations (operation_id, user_id) VALUES ('44444444-4444-4444-4444-444444444444', 99)")
	mustExec(t, pool, "INSERT INTO provisioning_operations (operation_id, user_id) VALUES ('55555555-5555-5555-5555-555555555555', 98)")
}

// TestOutbox checks the outbox constraints and the unpublished-rows index.
//
// Expected output:
//
//   - A JSON array payload or a blank name is refused. Ids grow in insert order.
//     The index covers only rows with published_at null.
func TestOutbox(t *testing.T) {
	pool := schemaPool(t)
	insert := "INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload) VALUES ($1, $2, $3, $4::jsonb)"

	mustExec(t, pool, insert, "profile", "42", "profile.created", `{"user_id": 42}`)
	mustExec(t, pool, insert, "profile", "42", "profile.updated", `{"user_id": 42}`)
	wantViolation(t, exec(pool, insert, "profile", "42", "x", `[1,2]`), codeCheck, "outbox_payload_is_object")
	wantViolation(t, exec(pool, insert, "profile", "42", "x", `"text"`), codeCheck, "outbox_payload_is_object")
	wantViolation(t, exec(pool, insert, " ", "42", "x", `{}`), codeCheck, "outbox_aggregate_type_valid")
	wantViolation(t, exec(pool, insert, "profile", "", "x", `{}`), codeCheck, "outbox_aggregate_id_valid")
	wantViolation(t, exec(pool, insert, "profile", "42", "", `{}`), codeCheck, "outbox_event_type_valid")
	wantViolation(t, exec(pool, "UPDATE outbox SET attempts = -1"), codeCheck, "outbox_attempts_nonnegative")

	mustExec(t, pool, "UPDATE outbox SET published_at = now() WHERE event_type = 'profile.created'")
	if got := count(t, pool, "SELECT count(*) FROM outbox WHERE published_at IS NULL"); got != 1 {
		t.Fatalf("%d unpublished rows, want 1", got)
	}

	def := queryString(t, pool, "SELECT indexdef FROM pg_indexes WHERE schemaname = 'users' AND indexname = 'outbox_unpublished_idx'")
	if !strings.Contains(def, "WHERE (published_at IS NULL)") {
		t.Fatalf("outbox_unpublished_idx = %q, want a partial index on unpublished rows", def)
	}
}
