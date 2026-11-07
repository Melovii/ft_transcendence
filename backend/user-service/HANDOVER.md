# User Service handover

Written by Beşir (Melovii) on 2026-11-07 when leaving the project.
Scope: epic #134 (sub-issues #135-#150), code in `backend/user-service`.

## Status

| Issue | Topic | State |
|-------|-------|-------|
| #135 | Service bootstrap (Gin, pgx, migrations, `/healthz`, `/readyz`, Docker) | Done, merged (#151) |
| #136 | Database schema and integration tests | Done, merged (#153) |
| #137 | Idempotent profile provisioning, internal token auth | Done on `feat/137-profile-provisioning`, pushed. PR #154 was closed unmerged; issue now assigned to Yiğit |
| #138-#150 | Remaining User Service work | Not started |

Suggested order for the rest: 138, 141, then 144-146, 139-140, 142-143, 148, 147, 149, 150.

## Decisions

- Data access: pgx with raw SQL, same as Auth and `backend/shared`. Database schema name is `users`.
- The Bruno collection (branch `bruno`) is the API contract and wins over older Notion pages.
- Friendships are request-then-accept. Redis is not part of the contract.
- Internal routes are protected by a shared token (see `README.md`).
- Feature branches are based on the Auth branch history because `backend/shared` lives there.

## Running and testing

- Go 1.27.1. Unit tests: `go test -race ./...` from `backend/user-service`.
- Integration tests under `tests/integration` need PostgreSQL 17 (Docker, port 5433).
- Migrations are in `migrations/` (000002-000005: profiles, social graph, reports, operations and outbox).

## What is implemented

- Service skeleton: Gin router, request-ID and recovery middleware, `/healthz` and `/readyz`, environment config, Dockerfile and compose (see `README.md`).
- Migrations run on startup under an advisory lock so concurrent starts do not race on schema creation.
- Tables (schema `users`): profiles with case-insensitive unique usernames; friendships, friend requests and blocks with pair-lock triggers; reports with one report per window (`users.file_report()`); operation records and a transactional outbox.
- Profile provisioning: internal endpoint, called by Auth with `operation_id`, `user_id`, `username`, account `created_at`. Identical retries are idempotent (payload fingerprint stored on the operation); reuse with a changed user or payload is rejected; an existing profile is never overwritten.
- Internal routes require a shared token, compared in constant time.
- Tests: unit tests plus PostgreSQL integration tests for schema constraints, concurrency, provisioning and internal auth.

## Next steps for the User Service

1. #138 and #141 first, then #144-#146, #139-#140, #142-#143, #148, #147, #149, #150.
2. Confirm with the backend lead where PRs target and the final internal API paths and service-to-service auth.
3. Reuse the operation and outbox tables for every social or profile mutation that must emit an event.

## Leave penalty (Game Session, not User Service)

- Done on branch `feat/leave-penalty-points`: `backend/Room/penalty.go` computes `leave_penalty_base × role_multiplier` (Spymaster strictly greater than Operative) and rejects unset or inconsistent values; `PenaltyConfigFromEnv` reads `LEAVE_PENALTY_BASE`, `LEAVE_PENALTY_SPYMASTER_MULTIPLIER` and `LEAVE_PENALTY_OPERATIVE_MULTIPLIER`. Tests included.
- Eligibility (voluntary leave, EXITED or SESSION_ENDED, while IN_GAME) already existed in `Room.Leave`.
- Remaining: call `Points` when `LeaveResult.Penalty` is set and append the `player.penalized` record (`user_id`, `room_id`, `game_id`, `role`, `reason`, `points`, `penalized_at`) to the Game outbox in the same transaction as the departure (outbox issue #171). Stats consumes it idempotently (#187).
- Decision for the team: the contract leaves all three values unset until agreed. Nothing is hardcoded. Set the environment variables once chosen.

## Open items

- Agree on the three penalty values (see above).
- Wire the penalty into the Game outbox (#171) and the Stats consumer (#187).
- PR #154 (#137) is closed unmerged; open a new PR from `feat/137-profile-provisioning`.
