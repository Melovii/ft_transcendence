# user-service

Owns canonical profiles, avatars, the social graph, reports, presence queries and
account deletion. It does not store passwords, tokens, game state or statistics.
The API contract is the Bruno collection on the `bruno` branch.

This is the bootstrap: configuration, a schema-scoped PostgreSQL connection,
embedded migrations, request IDs, the common error envelope and health checks.

## Endpoints

| Method and path  | Meaning                                                                            |
| ---------------- | ---------------------------------------------------------------------------------- |
| `GET /healthz` | Liveness. 200 while the process serves HTTP. Never touches the database.           |
| `GET /readyz`  | Readiness. 200 while PostgreSQL answers, otherwise 503 `DEPENDENCY_UNAVAILABLE`. |

Both sit outside `/api/v1` so the public reverse proxy does not expose them.
Success bodies use `{"data": ...}`, errors use `{"error": {"code", "message", "details"}}`.

## Configuration

Copy `.env.example` to `.env` for reference. The service reads the process
environment only and does not load `.env` itself.

| Variable                      | Default         | Meaning                                                                     |
| ----------------------------- | --------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`              | none, required  | `postgres://` URL. The service creates and uses its own `users` schema. |
| `PORT`                      | `8080`        | HTTP port.                                                                  |
| `APP_ENV`                   | `development` | `development`, `production` or `test`. Sets log defaults.             |
| `LOG_FORMAT`, `LOG_LEVEL` | by `APP_ENV`  | `text` or `json`; `debug`, `info`, `warn` or `error`.           |
| `MIGRATE_ON_START`          | `true`        | Apply embedded migrations at startup.                                       |

## Run locally

With Docker, from this directory:

```sh
docker compose up --build
curl localhost:8081/readyz
```

Without Docker for the service itself, from this directory, with a PostgreSQL
reachable at `DATABASE_URL`:

```sh
export DATABASE_URL='postgres://user:change-me-local-only@localhost:5433/user?sslmode=disable'
export PORT=8081
go run ./cmd/server
```

## Migrations

SQL files live in `migrations/` as `NNNNNN_description.up.sql` and `.down.sql`.
They are embedded in the binary and applied in order at startup. Progress is
recorded in `users.schema_migrations`. Several instances starting together are safe.

## Database schema

All tables live in the `users` schema. Cross-service ids (`user_id`, `room_id`)
are plain numbers with no foreign key. Foreign keys exist only inside `users`.

| Table                                                | Holds                                                                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `profiles`                                         | One row per Auth user. Username is unique ignoring case and surrounding spaces.                      |
| `friendships`                                      | One row per unordered pair, `user_low < user_high`. `active = false` means suspended by a block. |
| `friend_requests`                                  | Requests with history. One `pending` request per unordered pair.                                   |
| `blocks`                                           | Directional: blocker to blocked. Blocking suspends the friendship and cancels pending requests.      |
| `reports`                                          | Moderation reports. `users.file_report()` enforces one report per reporter and target per window.  |
| `provisioning_operations`, `deletion_operations` | Idempotent, resumable workflow records keyed by `operation_id`.                                    |
| `outbox`                                           | Transactional outbox. Unpublished rows have `published_at IS NULL`.                                |

Accepting a request: in one transaction, set the request to `accepted`, then
insert the friendship. The database refuses a new pending request while an
active friendship exists, and it takes a per-pair lock so this holds under races.

## Tests

From this directory:

```sh
go test ./tests/unit
go test ./tests/integration
```

Integration tests need a PostgreSQL server where the role may create databases.
They create and drop a throwaway database per test, and are skipped when the
variable is unset:

```sh
USER_TEST_DATABASE_URL='postgres://user:change-me-local-only@localhost:5433/user?sslmode=disable' \
  go test ./tests/integration
```

## Layout

```
cmd/server             entry point and wiring
internal/config        environment settings
internal/controller    HTTP handlers
internal/middleware    request IDs
internal/router        error-returning handler adapter
internal/server        Gin engine and middleware chain
internal/service       rules, no HTTP or SQL
internal/repository    PostgreSQL access, migrations runner
migrations             embedded SQL
tests/unit             no database needed
tests/integration      real PostgreSQL
```
