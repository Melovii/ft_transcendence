package integration_test

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TestFriendshipsRejectBadPairs checks the unordered-pair rules on friendships.
//
// Expected output:
//
//   - A reversed pair (2, 1) is rejected by the ordering check, so (1, 2) and
//     (2, 1) can never be stored as two rows. The same pair twice hits the
//     primary key. A self pair, an initiator outside the pair and a missing
//     profile are all rejected.
func TestFriendshipsRejectBadPairs(t *testing.T) {
	pool := schemaPool(t)
	seedProfiles(t, pool, 1, 2, 3)
	mustExec(t, pool, "INSERT INTO friendships (user_low, user_high, initiated_by) VALUES (1, 2, 1)")

	wantViolation(t, exec(pool, "INSERT INTO friendships (user_low, user_high, initiated_by) VALUES (2, 1, 1)"),
		codeCheck, "friendships_pair_ordered")
	wantViolation(t, exec(pool, "INSERT INTO friendships (user_low, user_high, initiated_by) VALUES (1, 2, 2)"),
		codeUnique, "friendships_pkey")
	wantViolation(t, exec(pool, "INSERT INTO friendships (user_low, user_high, initiated_by) VALUES (3, 3, 3)"),
		codeCheck, "friendships_pair_ordered")
	wantViolation(t, exec(pool, "INSERT INTO friendships (user_low, user_high, initiated_by) VALUES (1, 3, 2)"),
		codeCheck, "friendships_initiator_in_pair")
	wantViolation(t, exec(pool, "INSERT INTO friendships (user_low, user_high, initiated_by) VALUES (1, 99, 1)"),
		codeForeignKey, "friendships_user_high_fkey")
	if got := count(t, pool, "SELECT count(*) FROM friendships"); got != 1 {
		t.Fatalf("%d friendships stored, want 1", got)
	}
}

// TestFriendRequestsReversedPairConflicts checks that A to B and B to A cannot
// both be pending.
func TestFriendRequestsReversedPairConflicts(t *testing.T) {
	pool := schemaPool(t)
	seedProfiles(t, pool, 1, 2)
	mustExec(t, pool, "INSERT INTO friend_requests (requester_id, addressee_id) VALUES (1, 2)")

	wantViolation(t, exec(pool, "INSERT INTO friend_requests (requester_id, addressee_id) VALUES (2, 1)"),
		codeUnique, "friend_requests_one_pending_per_pair")
	wantViolation(t, exec(pool, "INSERT INTO friend_requests (requester_id, addressee_id) VALUES (1, 2)"),
		codeUnique, "friend_requests_one_pending_per_pair")
}

// TestFriendRequestsConcurrentBothDirections checks the same rule under a race.
//
// Expected output:
//
//   - Of six simultaneous requests, alternating direction, exactly one is
//     stored. The rest fail on the partial unique index.
func TestFriendRequestsConcurrentBothDirections(t *testing.T) {
	pool := schemaPool(t)
	seedProfiles(t, pool, 1, 2)

	var fns []func(context.Context, *pgxpool.Conn) error
	for i := range 6 {
		from, to := int64(1), int64(2)
		if i%2 == 1 {
			from, to = to, from
		}
		fns = append(fns, func(ctx context.Context, conn *pgxpool.Conn) error {
			_, err := conn.Exec(ctx, "INSERT INTO friend_requests (requester_id, addressee_id) VALUES ($1, $2)", from, to)

			return err
		})
	}
	results := race(t, pool, fns...)

	if got := countSuccesses(results); got != 1 {
		t.Fatalf("%d requests won, want exactly 1", got)
	}
	for _, r := range results {
		if r.err != nil {
			wantViolation(t, r.err, codeUnique, "friend_requests_one_pending_per_pair")
		}
	}
}

// TestFriendRequestsHistoryDoesNotBlock checks that resolved requests are kept
// and do not stop a later request.
func TestFriendRequestsHistoryDoesNotBlock(t *testing.T) {
	pool := schemaPool(t)
	seedProfiles(t, pool, 1, 2)
	mustExec(t, pool, "INSERT INTO friend_requests (requester_id, addressee_id) VALUES (1, 2)")
	mustExec(t, pool, "UPDATE friend_requests SET state = 'declined', resolved_at = now()")

	mustExec(t, pool, "INSERT INTO friend_requests (requester_id, addressee_id) VALUES (2, 1)")

	if got := count(t, pool, "SELECT count(*) FROM friend_requests"); got != 2 {
		t.Fatalf("%d requests stored, want 2", got)
	}
}

// TestFriendRequestsRejectBadRows checks the request CHECK constraints.
func TestFriendRequestsRejectBadRows(t *testing.T) {
	pool := schemaPool(t)
	seedProfiles(t, pool, 1, 2)

	wantViolation(t, exec(pool, "INSERT INTO friend_requests (requester_id, addressee_id) VALUES (1, 1)"),
		codeCheck, "friend_requests_not_self")
	wantViolation(t, exec(pool, "INSERT INTO friend_requests (requester_id, addressee_id, state, resolved_at) VALUES (1, 2, 'maybe', now())"),
		codeCheck, "friend_requests_state_valid")
	wantViolation(t, exec(pool, "INSERT INTO friend_requests (requester_id, addressee_id, state) VALUES (1, 2, 'accepted')"),
		codeCheck, "friend_requests_resolved_matches_state")
	wantViolation(t, exec(pool, "INSERT INTO friend_requests (requester_id, addressee_id, resolved_at) VALUES (1, 2, now())"),
		codeCheck, "friend_requests_resolved_matches_state")
	wantViolation(t, exec(pool, "INSERT INTO friend_requests (requester_id, addressee_id) VALUES (1, 99)"),
		codeForeignKey, "friend_requests_addressee_id_fkey")
	wantViolation(t, exec(pool, "UPDATE friend_requests SET user_low = 5"), "428C9", "")
}

// TestFriendRequestsNoPendingBesideActiveFriendship checks the trigger rule.
//
// Flow:
//
//  1. Create an active friendship, then try a request in both directions.
//  2. Accept a different pair the way the service will: update the request,
//     then insert the friendship, in one transaction.
//
// Expected output:
//
//   - Requests next to an active friendship fail. The accept transaction works.
func TestFriendRequestsNoPendingBesideActiveFriendship(t *testing.T) {
	pool := schemaPool(t)
	seedProfiles(t, pool, 1, 2, 3, 4)
	mustExec(t, pool, "INSERT INTO friendships (user_low, user_high, initiated_by) VALUES (1, 2, 1)")

	wantViolation(t, exec(pool, "INSERT INTO friend_requests (requester_id, addressee_id) VALUES (1, 2)"),
		codeCheck, "friend_requests_no_active_friendship")
	wantViolation(t, exec(pool, "INSERT INTO friend_requests (requester_id, addressee_id) VALUES (2, 1)"),
		codeCheck, "friend_requests_no_active_friendship")

	mustExec(t, pool, "INSERT INTO friend_requests (requester_id, addressee_id) VALUES (4, 3)")
	tx, err := pool.Begin(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	if _, err := tx.Exec(context.Background(), "UPDATE friend_requests SET state = 'accepted', resolved_at = now() WHERE requester_id = 4"); err != nil {
		t.Fatalf("accept request: %v", err)
	}
	if _, err := tx.Exec(context.Background(), "INSERT INTO friendships (user_low, user_high, initiated_by) VALUES (3, 4, 4)"); err != nil {
		t.Fatalf("create friendship: %v", err)
	}
	if err := tx.Commit(context.Background()); err != nil {
		t.Fatal(err)
	}
	wantViolation(t, exec(pool, "INSERT INTO friend_requests (requester_id, addressee_id) VALUES (3, 4)"),
		codeCheck, "friend_requests_no_active_friendship")
}

// TestFriendRequestWaitsForUncommittedFriendship checks that the pair lock closes
// the gap between the friendship check and the insert.
//
// Flow:
//
//  1. Open a transaction that inserts a friendship but does not commit.
//  2. In another connection, insert a request for the same pair. It must wait.
//  3. Commit the friendship.
//
// Expected output:
//
//   - The request insert is still waiting before the commit, and fails with the
//     friendship rule after it. Without the lock it would succeed at once.
func TestFriendRequestWaitsForUncommittedFriendship(t *testing.T) {
	pool := schemaPool(t)
	seedProfiles(t, pool, 1, 2)
	ctx := context.Background()

	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, "INSERT INTO friendships (user_low, user_high, initiated_by) VALUES (1, 2, 1)"); err != nil {
		t.Fatal(err)
	}

	done := make(chan error, 1)
	go func() {
		done <- exec(pool, "INSERT INTO friend_requests (requester_id, addressee_id) VALUES (2, 1)")
	}()
	select {
	case err := <-done:
		t.Fatalf("request insert finished before the friendship committed: %v", err)
	case <-time.After(300 * time.Millisecond):
	}

	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-done:
		wantViolation(t, err, codeCheck, "friend_requests_no_active_friendship")
	case <-time.After(5 * time.Second):
		t.Fatal("request insert still waiting after the commit")
	}
}

// TestBlocksRejectBadRows checks the block constraints and that blocking is directional.
func TestBlocksRejectBadRows(t *testing.T) {
	pool := schemaPool(t)
	seedProfiles(t, pool, 1, 2)

	wantViolation(t, exec(pool, "INSERT INTO blocks (blocker_id, blocked_id) VALUES (1, 1)"),
		codeCheck, "blocks_not_self")
	mustExec(t, pool, "INSERT INTO blocks (blocker_id, blocked_id) VALUES (1, 2)")
	wantViolation(t, exec(pool, "INSERT INTO blocks (blocker_id, blocked_id) VALUES (1, 2)"),
		codeUnique, "blocks_pkey")
	mustExec(t, pool, "INSERT INTO blocks (blocker_id, blocked_id) VALUES (2, 1)")
	wantViolation(t, exec(pool, "INSERT INTO blocks (blocker_id, blocked_id) VALUES (1, 99)"),
		codeForeignKey, "blocks_blocked_id_fkey")
}

// TestBlockSuspendsFriendshipAndKeepsTheRow checks that blocking never deletes a friendship.
//
// Flow:
//
//  1. Make users 1 and 2 friends and block 2 from user 1.
//  2. Add a pending request between 3 and 4, then block 3 from user 4.
//
// Expected output:
//
//   - The friendship row is still there with active = false.
//   - The pending request becomes cancelled with resolved_at set.
func TestBlockSuspendsFriendshipAndKeepsTheRow(t *testing.T) {
	pool := schemaPool(t)
	seedProfiles(t, pool, 1, 2, 3, 4)
	mustExec(t, pool, "INSERT INTO friendships (user_low, user_high, initiated_by) VALUES (1, 2, 1)")
	mustExec(t, pool, "INSERT INTO friend_requests (requester_id, addressee_id) VALUES (3, 4)")

	mustExec(t, pool, "INSERT INTO blocks (blocker_id, blocked_id) VALUES (1, 2)")
	mustExec(t, pool, "INSERT INTO blocks (blocker_id, blocked_id) VALUES (4, 3)")

	if got := count(t, pool, "SELECT count(*) FROM friendships WHERE user_low = 1 AND user_high = 2 AND NOT active"); got != 1 {
		t.Fatalf("friendship rows inactive = %d, want the row kept and inactive", got)
	}
	if got := count(t, pool, "SELECT count(*) FROM friend_requests WHERE state = 'cancelled' AND resolved_at IS NOT NULL"); got != 1 {
		t.Fatalf("cancelled requests = %d, want 1", got)
	}
	if got := count(t, pool, "SELECT count(*) FROM friend_requests WHERE state = 'pending'"); got != 0 {
		t.Fatalf("pending requests = %d, want 0", got)
	}
}

// TestUnblockRestoresFriendshipOnlyWhenNobodyBlocks checks the restore rule.
//
// Flow:
//
//  1. Friends 1 and 2 block each other, then 1 lifts the block.
//  2. 2 lifts the other block.
//  3. Users 3 and 4 were never friends and block then unblock.
//
// Expected output:
//
//   - The friendship stays inactive while any block remains and turns active
//     after the last one goes. Unblocking never creates a friendship, and the
//     request cancelled by a block stays cancelled.
func TestUnblockRestoresFriendshipOnlyWhenNobodyBlocks(t *testing.T) {
	pool := schemaPool(t)
	seedProfiles(t, pool, 1, 2, 3, 4)
	mustExec(t, pool, "INSERT INTO friendships (user_low, user_high, initiated_by) VALUES (1, 2, 2)")
	mustExec(t, pool, "INSERT INTO blocks (blocker_id, blocked_id) VALUES (1, 2), (2, 1)")

	mustExec(t, pool, "DELETE FROM blocks WHERE blocker_id = 1")
	if got := count(t, pool, "SELECT count(*) FROM friendships WHERE active"); got != 0 {
		t.Fatal("friendship became active while the other block remains")
	}
	mustExec(t, pool, "DELETE FROM blocks WHERE blocker_id = 2")
	if got := count(t, pool, "SELECT count(*) FROM friendships WHERE active"); got != 1 {
		t.Fatal("friendship did not become active after the last block was lifted")
	}

	mustExec(t, pool, "INSERT INTO friend_requests (requester_id, addressee_id) VALUES (3, 4)")
	mustExec(t, pool, "INSERT INTO blocks (blocker_id, blocked_id) VALUES (3, 4)")
	mustExec(t, pool, "DELETE FROM blocks WHERE blocker_id = 3")
	if got := count(t, pool, "SELECT count(*) FROM friendships WHERE user_low = 3"); got != 0 {
		t.Fatal("unblocking created a friendship")
	}
	if got := count(t, pool, "SELECT count(*) FROM friend_requests WHERE state = 'cancelled'"); got != 1 {
		t.Fatal("cancelled request did not stay cancelled")
	}
}

// TestDeletingProfileRemovesItsRelationships checks that account deletion leaves
// no dangling rows inside the schema.
func TestDeletingProfileRemovesItsRelationships(t *testing.T) {
	pool := schemaPool(t)
	seedProfiles(t, pool, 1, 2, 3)
	mustExec(t, pool, "INSERT INTO friendships (user_low, user_high, initiated_by) VALUES (1, 2, 1)")
	mustExec(t, pool, "INSERT INTO friend_requests (requester_id, addressee_id) VALUES (3, 1)")
	mustExec(t, pool, "INSERT INTO blocks (blocker_id, blocked_id) VALUES (2, 1)")

	mustExec(t, pool, "DELETE FROM profiles WHERE user_id = 1")

	for _, table := range []string{"friendships", "friend_requests", "blocks"} {
		if got := count(t, pool, "SELECT count(*) FROM "+table); got != 0 {
			t.Fatalf("%s still has %d rows after the profile was deleted", table, got)
		}
	}
}
