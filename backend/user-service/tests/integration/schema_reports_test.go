package integration_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// queryRower is satisfied by both a pool and a single connection.
type queryRower interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// fileReport calls users.file_report.
//
// It returns the new report id (nil when the window was still open) and the
// seconds to wait (nil when the report was stored).
func fileReport(ctx context.Context, q queryRower, reporter, target int64, reason string, windowSeconds float64) (id, retryAfter *int64, err error) {
	err = q.QueryRow(ctx, `
		SELECT out_report_id, retry_after_seconds
		FROM file_report($1, $2, $3, '', NULL, make_interval(secs => $4))`,
		reporter, target, reason, windowSeconds).Scan(&id, &retryAfter)

	return id, retryAfter, err
}

// TestReportsRejectBadRows checks the report CHECK constraints on direct inserts.
func TestReportsRejectBadRows(t *testing.T) {
	pool := schemaPool(t)
	tests := []struct {
		name       string
		sql        string
		constraint string
	}{
		{"self report", "INSERT INTO reports (reporter_id, target_id, reason) VALUES (5, 5, 'spam')", "reports_not_self"},
		{"zero reporter", "INSERT INTO reports (reporter_id, target_id, reason) VALUES (0, 5, 'spam')", "reports_reporter_positive"},
		{"negative target", "INSERT INTO reports (reporter_id, target_id, reason) VALUES (5, -1, 'spam')", "reports_target_positive"},
		{"unknown reason", "INSERT INTO reports (reporter_id, target_id, reason) VALUES (5, 6, 'rude')", "reports_reason_valid"},
		{"long details", "INSERT INTO reports (reporter_id, target_id, reason, details) VALUES (5, 6, 'spam', '" + strings.Repeat("x", 501) + "')", "reports_details_length"},
		{"bad room", "INSERT INTO reports (reporter_id, target_id, reason, room_id) VALUES (5, 6, 'spam', 0)", "reports_room_positive"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			wantViolation(t, exec(pool, tt.sql), codeCheck, tt.constraint)
		})
	}
}

// TestReportsNeedNoProfile checks that reports have no foreign key, so a report
// outlives a deleted profile.
func TestReportsNeedNoProfile(t *testing.T) {
	pool := schemaPool(t)

	mustExec(t, pool, "INSERT INTO reports (reporter_id, target_id, reason, details, room_id) VALUES (5, 6, 'harassment', 'rude', 1001)")
}

// TestFileReportWindow checks the one-report-per-window rule.
//
// Flow:
//
//  1. File a report with a 1 second window.
//  2. File again at once, then for another target, then after the window.
//
// Expected output:
//
//   - The repeat is refused with a retry delay of 1 second or less and stores
//     nothing. Another target is accepted. After the window a new report is accepted.
func TestFileReportWindow(t *testing.T) {
	pool := schemaPool(t)
	ctx := context.Background()

	id, retry, err := fileReport(ctx, pool, 1, 2, "spam", 1)
	if err != nil || id == nil || retry != nil {
		t.Fatalf("first report: id=%v retry=%v err=%v, want stored", id, retry, err)
	}
	id, retry, err = fileReport(ctx, pool, 1, 2, "cheating", 1)
	if err != nil || id != nil || retry == nil || *retry < 1 || *retry > 1 {
		t.Fatalf("repeat report: id=%v retry=%v err=%v, want refused with retry 1", id, retry, err)
	}
	if id, _, err = fileReport(ctx, pool, 1, 3, "spam", 1); err != nil || id == nil {
		t.Fatalf("report on another target: id=%v err=%v, want stored", id, err)
	}
	if id, _, err = fileReport(ctx, pool, 2, 1, "spam", 1); err != nil || id == nil {
		t.Fatalf("report in the other direction: id=%v err=%v, want stored", id, err)
	}

	time.Sleep(1100 * time.Millisecond)
	if id, _, err = fileReport(ctx, pool, 1, 2, "spam", 1); err != nil || id == nil {
		t.Fatalf("report after the window: id=%v err=%v, want stored", id, err)
	}
	if got := count(t, pool, "SELECT count(*) FROM reports"); got != 4 {
		t.Fatalf("%d reports stored, want 4", got)
	}
}

// TestFileReportConcurrent checks that simultaneous reports for one reporter and
// target store exactly one row.
func TestFileReportConcurrent(t *testing.T) {
	pool := schemaPool(t)

	var fns []func(context.Context, *pgxpool.Conn) error
	for range 8 {
		fns = append(fns, func(ctx context.Context, conn *pgxpool.Conn) error {
			_, _, err := fileReport(ctx, conn, 1, 2, "harassment", 3600)

			return err
		})
	}
	results := race(t, pool, fns...)

	if got := countSuccesses(results); got != len(fns) {
		t.Fatalf("%d calls succeeded, want all %d (refusals are not errors)", got, len(fns))
	}
	if got := count(t, pool, "SELECT count(*) FROM reports"); got != 1 {
		t.Fatalf("%d reports stored, want 1", got)
	}
}

// TestFileReportRejectsBadInput checks that the function still obeys the table rules.
func TestFileReportRejectsBadInput(t *testing.T) {
	pool := schemaPool(t)
	ctx := context.Background()

	_, _, err := fileReport(ctx, pool, 4, 4, "spam", 60)
	wantViolation(t, err, codeCheck, "reports_not_self")
	_, _, err = fileReport(ctx, pool, 4, 5, "rude", 60)
	wantViolation(t, err, codeCheck, "reports_reason_valid")
	if _, _, err = fileReport(ctx, pool, 4, 5, "spam", 0); err == nil {
		t.Fatal("a zero window was accepted")
	}
	for _, reason := range []string{"harassment", "cheating", "offensive_username", "spam", "other"} {
		if id, _, err := fileReport(ctx, pool, 4, 5+int64(len(reason)), reason, 60); err != nil || id == nil {
			t.Fatalf("reason %q: id=%v err=%v, want stored", reason, id, err)
		}
	}
}
