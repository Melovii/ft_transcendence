// status-service: the platform's public status page (roadmap Phase 1).
//
// It polls every backend's health endpoint across the web network on a fixed
// ticker and serves three things: /status.json for machines, /status.html for
// humans (through the gateway), and Prometheus metrics for alerting. It also
// watches the shared backups volume, so a stale backup becomes visible before
// an incident instead of after one.
package main

import (
	"bufio"
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/melmut-42/ft_transcendence/backend/shared/logging"
	"github.com/melmut-42/ft_transcendence/backend/shared/metrics"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	serviceName  = "status-service"
	pollInterval = 10 * time.Second
	probeTimeout = 3 * time.Second
	backupRoot   = "/backups"
)

// target describes one health probe. The default kind is "plain": any 2xx
// response means UP. The "pg_up" kind scrapes the postgres exporter's metrics
// endpoint and reads its pg_up gauge — the DB itself lives on the internal
// `db` network, so the exporter is the only sanctioned bridge.
type target struct {
	name string
	url  string
	kind string
}

// Add a line here when a service lands; NEW-SERVICE.md is the checklist.
var targets = []target{
	// No /health endpoint exists yet — the backend team owns that contract
	// (bruno: 00 - Contract & Health). Until it lands, the orchestrator-facing
	// /metrics (our own Phase 2 work) is the probe.
	{name: "auth-service", url: "http://auth-service:8080/metrics"},
	{name: "user-service", url: "http://user-service:8080/healthz"},
	{name: "postgres", url: "http://postgres-exporter:9187/metrics", kind: "pg_up"},
	{name: "prometheus", url: "http://prometheus:9090/prometheus/-/healthy"},
	{name: "grafana", url: "http://grafana:3000/api/health"},
	{name: "kibana", url: "http://kibana:5601/kibana/api/status"},
}

// Platform view metrics. They are prefixed platform_ so they never collide
// with the services' own metrics or Prometheus's built-in `up`.
var (
	serviceUp = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name: "platform_service_up", Help: "1 if the service's health probe succeeded.",
	}, []string{"service"})
	backupAge = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name: "platform_backup_age_seconds",
		Help: "Age of the newest backup artifact; -1 means none exists.",
	}, []string{"kind"})
)

type check struct {
	Name       string `json:"name"`
	Status     string `json:"status"`
	StatusCode int    `json:"status_code,omitempty"`
	LatencyMS  int64  `json:"latency_ms"`
}

type snapshot struct {
	UpdatedAt time.Time        `json:"updated_at"`
	Overall   string           `json:"overall"`
	Checks    []check          `json:"services"`
	Backups   map[string]float64 `json:"backup_age_seconds"`
}

var current atomic.Value // snapshot

func main() {
	prometheus.MustRegister(serviceUp, backupAge)

	logger, err := logging.New(logging.Config{
		Format: os.Getenv("LOG_FORMAT"), Level: os.Getenv("LOG_LEVEL"),
		Service: serviceName,
	}, os.Stdout)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	slog.SetDefault(logger)

	switch os.Getenv("APP_ENV") {
	case "production":
		gin.SetMode(gin.ReleaseMode)
	case "test":
		gin.SetMode(gin.TestMode)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	client := &http.Client{Timeout: probeTimeout}
	go pollLoop(ctx, client)

	router := gin.New()
	router.Use(metrics.Middleware(serviceName), gin.Recovery())
	router.GET("/status", servePage)
	router.GET("/status.json", serveJSON)
	router.GET("/metrics", metrics.Handler())

	server := &http.Server{Addr: ":8080", Handler: router,
		ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second}
	go func() {
		logger.Info("status service listening", "port", 8080, "targets", len(targets))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server stopped", "error", err)
			os.Exit(1)
		}
	}()
	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdownCtx)
}

// pollLoop refreshes the snapshot on every tick until the context ends.
func pollLoop(ctx context.Context, client *http.Client) {
	poll(client) // first snapshot before the first request can arrive
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			poll(client)
		}
	}
}

func poll(client *http.Client) {
	snap := snapshot{UpdatedAt: time.Now().UTC(), Backups: map[string]float64{}}
	allUp := true

	for _, t := range targets {
		c := probe(client, t)
		if c.Status != "UP" {
			allUp = false
		}
		snap.Checks = append(snap.Checks, c)
		serviceUp.WithLabelValues(t.name).Set(map[bool]float64{true: 1, false: 0}[c.Status == "UP"])
	}
	if allUp {
		snap.Overall = "UP"
	} else {
		snap.Overall = "DEGRADED"
	}

	for _, kind := range []string{"postgres", "elasticsearch"} {
		age, err := newestArtifactAge(filepath.Join(backupRoot, kind))
		if err != nil {
			slog.Warn("backup directory unreadable", "kind", kind, "error", err)
			age = -1
		}
		snap.Backups[kind] = age
		backupAge.WithLabelValues(kind).Set(age)
	}

	current.Store(snap)
}

func probe(client *http.Client, t target) check {
	start := time.Now()
	response, err := client.Get(t.url)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		slog.Warn("probe failed", "target", t.name, "error", err)
		return check{Name: t.name, Status: "DOWN", LatencyMS: latency}
	}
	defer response.Body.Close()

	ok := response.StatusCode >= 200 && response.StatusCode < 300
	if ok && t.kind == "pg_up" {
		ok = pgUp(response)
	}
	status := "DOWN"
	if ok {
		status = "UP"
	}
	return check{Name: t.name, Status: status, StatusCode: response.StatusCode, LatencyMS: latency}
}

// pgUp scans the exporter's metrics text for a healthy pg_up gauge.
func pgUp(response *http.Response) bool {
	scanner := bufio.NewScanner(response.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "pg_up ") && strings.HasSuffix(line, " 1") {
			return true
		}
	}
	return false
}

// newestArtifactAge returns the age of the newest file under dir, recursively
// — the Elasticsearch snapshot repository nests subdirectories. -1 means the
// directory holds no backup yet (also the "never backed up" alert signal).
func newestArtifactAge(dir string) (float64, error) {
	newest := time.Time{}
	err := filepath.WalkDir(dir, func(_ string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if info.ModTime().After(newest) {
			newest = info.ModTime()
		}
		return nil
	})
	if err != nil {
		return -1, err
	}
	if newest.IsZero() {
		return -1, nil
	}
	return time.Since(newest).Seconds(), nil
}

func serveJSON(c *gin.Context) {
	snap, _ := current.Load().(snapshot)
	c.JSON(http.StatusOK, snap)
}

func servePage(c *gin.Context) {
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(statusPage))
}