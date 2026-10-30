// Package metrics exposes the platform's Prometheus instrumentation
// (issues #73–79): a Gin middleware recording request counters and latencies,
// and the scrape handler every service mounts at GET /metrics.
//
// Metric naming conventions (docs/NEW-SERVICE.md):
//
//	http_requests_total{service,method,route,status}   — counter
//	http_request_duration_seconds{service,route}       — histogram, seconds
//
// The route label uses Gin's route pattern (e.g. /api/v1/auth/login), never
// the raw path, so label cardinality stays bounded.
package metrics

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	requests = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "HTTP requests processed by the service, by route and status.",
		},
		[]string{"service", "method", "route", "status"},
	)

	durations = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "http_request_duration_seconds",
			Help: "HTTP request latencies in seconds.",
			Buckets: []float64{
				0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
			},
		},
		[]string{"service", "route"},
	)
)

func init() {
	prometheus.MustRegister(requests, durations)
}

// Handler serves the Prometheus scrape endpoint. Register it outside /api/v1
// — like /healthz it is orchestrator-facing and the gateway does not proxy it.
//
//	router.GET("/metrics", metrics.Handler())
func Handler() gin.HandlerFunc {
	return gin.WrapH(promhttp.Handler())
}

// Middleware records request counts and latencies for the named service.
// Mount it before the recovery middleware so recovered panics are still
// counted with their 500 status:
//
//	router.Use(requestid.Middleware(), requestLogger(logger), metrics.Middleware("auth-service"), recovery)
func Middleware(service string) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		route := c.FullPath()
		if route == "" {
			route = "unmatched"
		}

		durations.WithLabelValues(service, route).Observe(time.Since(start).Seconds())
		requests.WithLabelValues(service, c.Request.Method, route, strconv.Itoa(c.Writer.Status())).Inc()
	}
}