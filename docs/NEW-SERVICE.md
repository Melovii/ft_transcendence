# Adding a new microservice to the platform

This is the recipe for putting a backend service (game-service, chat gateway,
Web BFF, ...) onto the containerized platform. The platform lives on the
`devops` branch; your service code lives on your workstream branch. At
integration both meet in one compose file — this doc is the contract between
your service and the platform.

The platform provides:

| Thing | Convention |
|---|---|
| Ingress | One nginx gateway, TLS on 443. Your service is never published directly. |
| Routing | `/api/v1/<your-domain>/*` for REST, `/ws/<your-domain>` for WebSockets. |
| Networks | `web` (gateway-facing) and `db` (internal, postgres). Join only what you use. |
| Config | Environment variables only, validated at startup, never files baked into images. |
| Logs | Structured JSON to **stdout** — the ELK pipeline (issues #56–63) ships container stdout. Nothing else. |
| Metrics | `/metrics` on your service port; Prometheus (issues #73–79) scrapes over the `web` network. |
| Health | `GET /api/v1/health` per the Bruno contract; compose healthchecks build on it. |

## 1. Directory and module

```
backend/<your-service>/
├── Dockerfile
├── go.mod            # module github.com/melmut-42/ft_transcendence/backend/<your-service>
├── migrations/       # NNNNNN_name.up.sql / .down.sql (golang-migrate convention)
└── ...
```

If your module uses `backend/shared`, keep the `replace ../shared` directive
(see `backend/auth-service/go.mod`) and build with context `./backend` so the
directive resolves inside Docker too.

## 2. Dockerfile

Copy `backend/auth-service/Dockerfile` and adjust the build target. The rules
that matter to the platform:

- Multi-stage build; final image is a slim base (alpine/distroless), no build tools
- Runs as a non-root user
- Listens on `PORT` (default 8080) — the gateway reaches you by compose DNS name
- Logs go to stdout/stderr only

## 3. Compose block

Append to `docker-compose.yml` (a commented template sits at the top of the
services list):

```yaml
  my-service:
    build:
      context: ./backend
      dockerfile: my-service/Dockerfile
    environment:
      PORT: "8080"
      APP_ENV: ${APP_ENV}
      LOG_FORMAT: ${LOG_FORMAT}
      LOG_LEVEL: ${LOG_LEVEL}
      # only what your service uses:
      # DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/mydb?sslmode=disable
      # JWT_SECRET: ${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      my-migrate:
        condition: service_completed_successfully
    networks:
      - web
      - db          # only if you own SQL tables
    restart: unless-stopped
```

**Least privilege:** join `web` only if the gateway routes to you; join `db`
only if you own tables. A service that can't reach a network can't be attacked
through it — this is the platform's firewall posture.

## 4. Your own migrate job

One one-shot block per service (copy the `migrate` block and point it at your
migrations directory and database name):

```yaml
  my-migrate:
    image: migrate/migrate:v4.18.3
    volumes:
      - ./backend/my-service/migrations:/migrations:ro
    command: ["-path", "/migrations", "-database", "postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/mydb?sslmode=disable", "up"]
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - db
    restart: "no"
```

One database per service (`auth` exists; create yours with
`make psql` → `CREATE DATABASE mydb;`). Services never read each other's
databases — that boundary is what keeps them loosely coupled.

## 5. Gateway route

In `gateway/nginx.conf`:

```nginx
location /api/v1/my-domain/ {
    proxy_pass http://my-service:8080;
    # same proxy headers as the auth block
}
```

For WebSockets, use the commented `/ws` upgrade block as the pattern.

## 6. Verify

```bash
make up
curl -k https://localhost/api/v1/my-domain/health   # from the host
docker compose exec my-service wget -qO- http://localhost:8080/api/v1/health  # in-container
```

## 7. Session validation (no coupling to auth-service)

Validate the JWT access token locally with the shared `JWT_SECRET` — do not
call auth-service per request. Auth owns issuance and refresh; every other
service only verifies signatures. This keeps services independently operable:
stopping auth-service must not take down a running game.