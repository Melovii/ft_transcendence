package metrics

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/testutil"
)

// newEngine returns a Gin engine wired like the services: metrics middleware,
// a sample route and the scrape endpoint.
func newEngine() *gin.Engine {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(Middleware("test-service"))
	engine.GET("/metrics", Handler())
	engine.GET("/api/v1/ping", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	return engine
}

// TestMiddlewareCountsRequests verifies one request increments the counter for
// its service, method, route and status, and that unmatched paths fall back to
// the "unmatched" route label instead of the raw high-cardinality path.
func TestMiddlewareCountsRequests(t *testing.T) {
	engine := newEngine()

	for _, path := range []string{"/api/v1/ping", "/api/v1/ping", "/nope"} {
		response := httptest.NewRecorder()
		engine.ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
		if response.Code != http.StatusOK && response.Code != http.StatusNotFound {
			t.Fatalf("GET %s: unexpected status %d", path, response.Code)
		}
	}

	want := []struct {
		route  string
		status string
		value  float64
	}{
		{"/api/v1/ping", "200", 2},
		{"unmatched", "404", 1},
	}
	for _, w := range want {
		counter := requests.WithLabelValues("test-service", http.MethodGet, w.route, w.status)
		if got := testutil.ToFloat64(counter); got != w.value {
			t.Errorf("requests %s %s = %v, want %v", w.route, w.status, got, w.value)
		}
	}
}

// TestHandlerServesScrapeFormat verifies the scrape endpoint answers 200 and
// exposes the platform metric names.
func TestHandlerServesScrapeFormat(t *testing.T) {
	engine := newEngine()

	response := httptest.NewRecorder()
	engine.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/metrics", nil))

	if response.Code != http.StatusOK {
		t.Fatalf("GET /metrics: status %d, want %d", response.Code, http.StatusOK)
	}
	for _, name := range []string{"http_requests_total", "http_request_duration_seconds"} {
		if !strings.Contains(response.Body.String(), name) {
			t.Errorf("scrape body missing %s", name)
		}
	}
}

// TestMiddlewareMeasuresDuration verifies the latency histogram records an
// observation for the served route.
func TestMiddlewareMeasuresDuration(t *testing.T) {
	engine := newEngine()
	engine.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/v1/ping", nil))

	if got := testutil.CollectAndCount(durations); got == 0 {
		t.Error("latency histogram has no observations")
	}
}