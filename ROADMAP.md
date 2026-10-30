# DevOps + Cybersecurity Setup Roadmap

**Workstream:** `devops` branch · **Owner:** you · **Modules targeted:** 9 of the required 14 points

| Category | Module | Level | Points |
|---|---|---|---|
| DevOps | ELK log management | Major | 2 |
| DevOps | Prometheus + Grafana monitoring | Major | 2 |
| DevOps | Backend as microservices | Major | 2 |
| DevOps | Health check + status page | Minor | 1 |
| Cybersecurity | WAF (ModSecurity) + HashiCorp Vault | Major | 2 |

This roadmap is ordered by dependency, not by points: every phase either unlocks the next
one or can be demonstrated on its own. Each phase lists what you build, the commands that
prove it works, and the concept you should be able to explain at evaluation.

---

## Current state (what this builds on)

- `auth-service` is the only runnable backend: Go 1.27 + Gin + pgx/v5, cookie sessions with
  refresh-token rotation, SQL migrations in `backend/auth-service/migrations/` (no runner wired),
  structured `slog` JSON logs, `.env.example` present. It reads config from env vars at startup.
- `frontend` is a mature React 19 + Vite 7 app whose dev proxy expects the API at
  `http://localhost:3000` same-origin — the reverse proxy does not exist yet.
- `game` is a pure Go domain package with no transport layer.
- `bruno` is the API contract (source of truth). It already defines `GET /api/v1/health`.
- **No Dockerfile, compose file, CI config, health check, or backup exists anywhere yet.**

### Known gotchas (read before Phase 0)

1. `backend/auth-service/go.mod` has a `replace` → `../shared` directive. Docker builds must
   copy `backend/shared/` next to `backend/auth-service/` or the build fails.
2. Go toolchain pins are inconsistent across branches (`1.27.0` vs `1.27.1`). Pick one and pin
   it in the Dockerfile; that becomes the team standard.
3. Migrations are plain SQL files. Something must apply them on startup or via a one-shot job.
4. Teammates run the backend locally without Docker. Everything you build keeps a
   non-Docker path working (`VAULT_ADDR` unset → plain `.env`, mock mode → no backend needed).

---

## Phase 0 — Container platform (foundation, ~2–3 days)

**Goal:** the whole project runs with one command, over HTTPS, through one gateway.
This is mandatory-part compliance and the base for every module.

**Build:**

```
.
├── gateway/
│   ├── Dockerfile            # nginx, TLS, /api + /ws proxy, serves SPA build
│   └── nginx.conf
├── backend/auth-service/Dockerfile   # multi-stage Go build (copies ../shared)
├── docker-compose.yml        # postgres, auth-service, gateway
├── Makefile                  # make up / down / logs / psql / restore
├── .env.example              # root-level, no secrets
├── .gitignore                # .env, certs, backups/
└── scripts/
    └── make-cert.sh          # self-signed localhost cert
```

**Key decisions:**

- One gateway container terminates TLS and serves the built SPA — one ingress, one place
  for the WAF later. The frontend does not get its own server.
- Two Docker networks: `web` (gateway ↔ auth-service) and `db` (auth-service ↔ postgres,
  marked `internal: true` so the database has no route to the outside — your first
  firewall outcome).
- Only the gateway publishes ports (`443`). Everything else is unreachable by design.
- Migrations: a short-lived `migrate` compose service (postgres image + `psql -f`) that runs
  the `.up.sql` files and exits; `auth-service` waits for it via `depends_on: service_completed_successfully`.

**Verify:**

```bash
make up
curl -k https://localhost/                      # SPA loads
# register + login through the UI, then:
git grep -i "JWT_SECRET"                        # nothing real committed
docker compose ps                              # all green
```

**Learn (explain at evaluation):** image vs. container vs. volume vs. network; why multi-stage
builds shrink attack surface; what `internal: true` does; how Docker implements published ports
with kernel firewall rules (the ufw bypass gotcha).

---

## Phase 1 — Health, status page, backups (~1–2 days)

**Goal:** the Minor module (1 pt) plus operational safety net.

**Build:**

- `GET /api/v1/health` handler in auth-service: DB ping + contract version, exactly as the
  Bruno contract specifies. (~20 lines: route + handler. Coordinate this as a small PR to
  `auth-service` — it is backend code.)
- `status/` — a tiny Go static service (or nginx subrequest design) on the `web` network that
  polls each backend's `/health` every 10s and serves `status.html` + `/status.json`.
- `backup/` — a compose service running nightly `pg_dump` to a `backups/` volume, retaining
  7 days; `scripts/restore.sh` restores the latest dump into a fresh Postgres.
- `docs/dr.md` — the disaster-recovery procedure: what backs up, how often, how to restore,
  what the RTO/RPO targets are.

**Verify:**

```bash
docker compose stop auth-service
curl -k https://localhost/status.json          # auth-service: DOWN
scripts/restore.sh latest                       # restored DB boots + login works
```

**Learn:** liveness vs. readiness semantics; why backup ≠ restore (an untested backup is
a hope, not a control); ransomware resilience — and why real-world backups must be
immutable/offline (ransomware deletes reachable backups first).

---

## Phase 2 — Prometheus + Grafana (~2–3 days)

**Goal:** the monitoring Major module (2 pts).

**Status: built and verified (2026-10-30).** All six scrape targets up, alert
firing/recovery tested (ServiceDown on a stopped auth-service), Grafana
behind `/grafana` with a generated admin password, Prometheus UI behind
`/prometheus` behind nginx basic auth. Zero extra published ports.

**Build:**

```
monitoring/
├── prometheus.yml            # scrape configs
├── alerts.yml                # alerting rules
└── grafana/
    ├── datasources/          # provisioned as code
    ├── dashboards/          # HTTP golden signals, DB, containers
    └── alerting/            # alert notification channels
```

- Prometheus scrapes: auth-service and user-service metrics endpoints (done:
  `backend/shared/metrics` middleware, convention in docs/NEW-SERVICE.md §8),
  postgres-exporter, node-exporter, plus a blackbox probe through the public
  HTTPS chain so service-down means what a user experiences.
- Grafana behind the gateway with its own login; never publishes a port directly.
- Alert rules: service down > 1m, p95 latency, DB disk, backup file age (feeds Phase 1).

**Verify:** run a login, watch the request counter and latency panel move; stop auth-service
and watch the alert fire; try to reach Grafana directly on its internal port — you can't.

**Learn:** the Prometheus pull model and data model (time series = metric + labels); PromQL
thresholds are conceptually the same machinery as SIEM detection rules — baseline first,
then alert on deviation.

---

## Phase 3 — ELK (~2–3 days)

**Goal:** the log-management Major module (2 pts). This is the module with the highest
security-skill transfer — the ELK stack is the open core of every SIEM.

**Build:**

```
logging/
├── logstash/pipeline.conf    # gelf/tcp input, parse JSON slog, tag by service
└── elasticsearch/ilm.json    # hot → delete at 30 days + weekly snapshot
```

- Docker `gelf` log driver ships container stdout (auth-service's `slog` JSON is already
  structured) to Logstash; Logstash enriches with `service`, keeps `request_id`.
- Elasticsearch on `internal: true` networks only. Kibana behind the gateway with auth.
- ILM policy implements the subject's "retention and archiving" requirement; snapshots
  land on the `backups/` volume.

**Verify:** log in, then find your own `request_id` in Kibana across every log line that
request produced; show the ILM policy; try opening Elasticsearch directly — unreachable.

**Learn:** log normalization and correlation = incident-response forensics; why retention
policy is also an anti-tampering control; the pipeline telemetry → query → detection is
what a SOC does daily.

---

## Phase 4 — Microservices (Major, 2 pts — coordinate with team)

**Goal:** formalize the service split. **Depends on backend work that doesn't exist yet**
(game-service and chat-service), so: start the scaffolding now, finish when they land.

**Your part:**

- `game-service/` container wrapping the existing `backend/Game/` domain package with a
  REST/WS transport — the interfaces are already specified in the `bruno` v2 contracts.
- Redis container (already planned in the team README) for cross-service events;
  per-service networks; per-service `/health` and metrics.
- Compose stays the single entry point: `docker compose up` still brings up everything.

**Verify:** stop and upgrade one service while another keeps serving; every service has
exactly one responsibility and one contract.

**Learn:** every service boundary is a trust boundary; blast radius (one compromised service
shouldn't own everything); this is the reasoning behind zero-trust architectures.

---

## Phase 5 — WAF + Vault (Cybersecurity Major, 2 pts, ~2–3 days)

**Goal:** hardened ModSecurity on the gateway + all secrets in Vault. Zero application
restructure — both pieces live on this branch.

**Build:**

- `gateway/` image gains ModSecurity + OWASP Core Rule Set, `SecRuleEngine On` (strict,
  not detection-only). Tuning file with exclusions for the `password` parameter on
  `/api/v1/auth/login` and `/register` (CRS will false-positive on passwords containing
  SQL-looking characters), and for avatar uploads.
- ModSecurity audit log piped into the Phase 3 ELK stack.
- `vault/` — Vault container (dev server for local), KV v2 secrets for `JWT_SECRET`,
  `DATABASE_URL`, ELK/Grafana credentials; an AppRole policy restricting auth-service to
  `secret/data/auth-service/*`; optional ~40-line `backend/shared/vaultsecrets/` helper
  that populates env vars before `config.Load()` — with a plain-`.env` fallback when
  `VAULT_ADDR` is unset (document that production never gets the fallback).
- Root `.env.example` now documents only non-secret config.

**Verify:**

```bash
# SQLi attempt → blocked, logged, while a real login still works
curl -k https://localhost/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@b.c","password":"'"'"' OR 1=1 --"}'
# 403 + an audit-log entry in Kibana
```

Revoke the AppRole → auth-service can no longer fetch secrets. `git grep` finds nothing real.

**Learn:** WAF rule tuning and false-positive triage (the actual day job of AppSec);
static vs. dynamic secrets, lease/revocation, least-privilege policies; supply-chain thinking
(what has access to what, and why).

---

## Phase 6 — CI (~1 day)

**Goal:** keep it all green; also listed as recommended practice by the subject.

**Build:** `.github/workflows/ci.yml` — Go lint + vet + unit tests; integration tests with a
Postgres service container providing `POSTGRES_TEST_DATABASE_URL`; frontend `tsc` + eslint +
build; `docker compose config` validation on every PR.

**Verify:** a PR touching backend and frontend runs everything and passes.

---

## Team coordination — what you need, and from whom

| Need | From | Phase |
|---|---|---|
| Health endpoint PR (`GET /api/v1/health`) | auth-service owner (or you) | 1 |
| Metrics middleware PR (`client_golang` in Gin) | auth-service owner | 2 |
| game-service + chat-service transports | backend team | 4 |
| Bruno local env updated to `https://localhost` | contract owner | 0 |

Everything else (compose, gateway, ELK, Prometheus, Vault, WAF, backups, CI) lives entirely
on the `devops` branch.

## Evaluation run-sheet

Practice this sequence end to end before the defense:

1. `make up` — single command, whole stack, HTTPS.
2. Register + login + play through the UI.
3. Stop auth-service → status page red, Prometheus alert firing, Grafana panel down.
4. Restart → everything green again.
5. `' OR 1=1 --` at the login endpoint → 403 + audit log visible in Kibana.
6. Trace one real `request_id` through Kibana.
7. Restore the latest backup into a fresh Postgres → login works.
8. Show Vault policies, revoke the AppRole, restart the service → it cannot boot.
9. Explain: what `internal: true` does, why Kibana/Elasticsearch/Grafana publish no ports,
   every WAF exclusion and why it exists, the retention policy, the DR procedure.

## Suggested order of work (first two weeks)

- **Days 1–3:** Phase 0 complete and demoable to the team. This unblocks everyone: teammates
  get `make up` for integration testing, and you get a platform to build the modules on.
- **Days 4–5:** Phase 1 (quick point) + health/metrics PRs.
- **Week 2:** Phase 2, then Phase 3.
- **Ongoing:** Phase 5 in parallel (it's config-heavy, not code-heavy); Phase 4 tracks the
  backend team; Phase 6 last.