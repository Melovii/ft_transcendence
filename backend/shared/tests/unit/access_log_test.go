package unit_test

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/melmut-42/ft_transcendence/backend/shared/logging"
	"strings"
	"testing"
	"time"
)

// TestAccessLogFormats checks access-log encoding and severity filtering.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - text/json formats and debug/info/warn/error thresholds.
//   - Statuses 200, 302, 400 and 500; a UTC+3 timestamp with nanoseconds; latency=85ms; a path
//     containing a newline and quote.
//
// Flow:
//
//  1. Create a logger per format/threshold pair and log all four statuses.
//  2. Split output into lines and compare the accepted status list.
//  3. Decode JSON or inspect text to verify severity, timestamp, service and escaping.
//
// Expected output:
//
//   - debug/info emit four records; warn emits 400/500; error emits only 500.
//   - 2xx/3xx use INFO, 4xx WARN and 5xx ERROR; timestamps use UTC RFC3339Nano.
//   - Each record occupies one line; JSON preserves latency=85ms and the original path, while
//     text escapes the path.
func TestAccessLogFormats(t *testing.T) {
	for _, format := range []string{"text", "json"} {
		for _, threshold := range []struct {
			level    string
			statuses []int
		}{
			{"debug", []int{200, 302, 400, 500}},
			{"info", []int{200, 302, 400, 500}},
			{"warn", []int{400, 500}},
			{"error", []int{500}},
		} {
			t.Run(format+"/"+threshold.level, func(t *testing.T) {
				checkAccessLogFormat(t, format, threshold.level, threshold.statuses)
			})
		}
	}
}

// TestLoggerLevels checks application-log filtering and configuration rejection.
//
// Parameters:
//
//   - t: Go test runner used for subtests, assertions and failure reporting.
//
// Inputs:
//
//   - A JSON logger with level=warn and service=test-service.
//   - One call at each severity; invalid format=xml and level=trace configurations.
//
// Flow:
//
//  1. Write debug, info, warn and error messages into a buffer.
//  2. Count newline-delimited records, then attempt to create invalid loggers.
//
// Expected output:
//
//   - Exactly two log records are emitted at the warn threshold.
//   - Both unsupported configurations return errors.
func TestLoggerLevels(t *testing.T) {
	var output bytes.Buffer
	logger, err := logging.New(logging.Config{Format: "json", Level: "warn", Service: "test-service"}, &output)
	if err != nil {
		t.Fatal(err)
	}
	logger.Debug("debug")
	logger.Info("info")
	logger.Warn("warn")
	logger.Error("error")
	if strings.Count(output.String(), "\n") != 2 {
		t.Fatalf("unexpected application logs: %s", output.String())
	}
	for _, cfg := range []logging.Config{{Format: "xml"}, {Level: "trace"}} {
		if _, err := logging.New(cfg, &output); err == nil {
			t.Fatalf("invalid config accepted: %+v", cfg)
		}
	}
}

func checkAccessLogFormat(t *testing.T, format, threshold string, statuses []int) {
	t.Helper()
	var output bytes.Buffer
	logger, err := logging.New(logging.Config{Format: format, Level: threshold, Service: "test-service"}, &output)
	if err != nil {
		t.Fatal(err)
	}
	stamp := time.Date(2026, 10, 2, 14, 30, 0, 123, time.FixedZone("local", 3*60*60))
	for _, status := range []int{200, 302, 400, 500} {
		logging.LogAccess(context.Background(), logger, logging.AccessLog{
			Time: stamp, RequestID: "request-123", Status: status,
			Latency: 85 * time.Millisecond, Method: "GET", Path: "/path\nforged\"value",
		})
	}
	lines := strings.Split(strings.TrimSuffix(output.String(), "\n"), "\n")
	if len(lines) != len(statuses) {
		t.Fatalf("wrong record count: %s", output.String())
	}
	for i, line := range lines {
		checkAccessLogRecord(t, line, format, statuses[i], stamp)
	}
}

func checkAccessLogRecord(t *testing.T, line, format string, status int, stamp time.Time) {
	t.Helper()
	level := "INFO"
	if status >= 500 {
		level = "ERROR"
	} else if status >= 400 {
		level = "WARN"
	}
	if format == "json" {
		var record map[string]any
		if err := json.Unmarshal([]byte(line), &record); err != nil {
			t.Fatal(err)
		}
		if record["status"] != float64(status) || record["level"] != level || record["service"] != "test-service" ||
			record["time"] != stamp.UTC().Format(time.RFC3339Nano) || record["latency"] != "85ms" || record["path"] != "/path\nforged\"value" {
			t.Fatalf("unexpected record: %s", line)
		}
	} else if !strings.Contains(line, "level="+level) || !strings.Contains(line, stamp.UTC().Format(time.RFC3339Nano)) ||
		!strings.Contains(line, "service=test-service") || !strings.Contains(line, `path="/path\nforged\"value"`) {
		t.Fatalf("unexpected text record: %s", line)
	}
}
