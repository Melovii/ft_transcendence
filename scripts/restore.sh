#!/bin/sh
# Disaster recovery (roadmap Phase 1, full procedure in docs/dr.md).
#
# Restores the newest backups into the running stack:
#   1. newest pg_dumpall from the backups volume -> a FRESH Postgres
#      (the pgdata volume is wiped first)
#   2. newest Elasticsearch snapshot -> the ftx-logs-* indices
#
# Destructive: everything in Postgres since the last backup is lost.
# Set FORCE=1 to skip the confirmation prompt (unattended drills).
#
# An untested restore is a hope, not a control: this script IS the
# procedure, so run it after any backup-stack change.
set -eu

cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
. ./.env

say() { printf '\033[1m== %s\033[0m\n' "$*"; }

# Run a shell command inside the backup image (it has curl, jq, the
# backups volume, and access to the db + logging networks).
run_backup() { docker compose run --rm --no-deps --entrypoint sh backup -c "$1"; }

# ── find the artifacts, fail fast before destroying anything ──────────────

DUMP=$(run_backup 'ls -t /backups/postgres/*.sql.gz 2>/dev/null | head -n1')
if [ -z "$DUMP" ]; then
  echo "no postgres dump in the backups volume — nothing to restore" >&2
  exit 1
fi
say "newest postgres dump: $DUMP"

SNAP=$(run_backup 'curl -fs -u "elastic:$ELASTIC_PASSWORD" \
  http://elasticsearch:9200/_snapshot/ftx-backups/_all \
  | jq -r ".snapshots | max_by(.start_time_in_millis) | .snapshot // empty"')
if [ -n "$SNAP" ]; then
  say "newest elasticsearch snapshot: $SNAP"
else
  say "no elasticsearch snapshot found — skipping the log restore"
fi

# ── confirm ───────────────────────────────────────────────────────────────

if [ "${FORCE:-0}" != "1" ]; then
  printf 'This WIPES the postgres volume and replays %s.\nContinue? [y/N] ' "$DUMP"
  read -r reply
  case $reply in
    y | Y | yes | YES) ;;
    *) echo "aborted"; exit 1 ;;
  esac
fi

# ── postgres: fresh instance, then replay the dump ────────────────────────

# Stop the writers, not the platform: elasticsearch must stay up for the
# snapshot restore, and the status service keeps reporting through it.
say "stopping the database writers"
docker compose stop auth-service user-service

say "wiping the postgres volume"
docker compose rm -sf postgres >/dev/null
# Compose project is `ftx` (docker-compose.yml), hence ftx_pgdata.
docker volume rm ftx_pgdata >/dev/null

say "starting a fresh postgres"
docker compose up -d postgres >/dev/null
until docker compose exec -T postgres pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; do
  sleep 2
done

say "replaying the dump (a few already-exists errors are normal)"
run_backup "gunzip -c '$DUMP'" \
  | docker compose exec -T postgres psql -q -v ON_ERROR_STOP=0 -U "$POSTGRES_USER" -d postgres

# ── elasticsearch: re-register the repo, then restore the log indices ─────

if [ -n "$SNAP" ]; then
  say "restoring the ftx-logs-* indices from $SNAP"
  # ES blocks wildcard deletes by default (action.destructive_requires_name):
  # collect the snapshot's log-index names and delete each explicitly.
  # Restore only the application's indices: the live system indices
  # (.kibana*, .security-*, ...) already exist and are not ours to clobber.
  run_backup '
    for idx in $(curl -fs -u "elastic:$ELASTIC_PASSWORD" \
        "http://elasticsearch:9200/_snapshot/ftx-backups/'"$SNAP"'" \
        | jq -r ".snapshots[0].indices[]" | grep "^ftx-logs-" || true); do
      curl -fs -u "elastic:$ELASTIC_PASSWORD" \
        -X DELETE "http://elasticsearch:9200/$idx" >/dev/null || true
    done
    curl -fs -u "elastic:$ELASTIC_PASSWORD" -H "Content-Type: application/json" \
      -X PUT "http://elasticsearch:9200/_snapshot/ftx-backups" \
      -d "{\"type\":\"fs\",\"settings\":{\"location\":\"elasticsearch\"}}" >/dev/null
    curl -fs -u "elastic:$ELASTIC_PASSWORD" -H "Content-Type: application/json" \
      -X POST "http://elasticsearch:9200/_snapshot/ftx-backups/'"$SNAP"'/_restore?wait_for_completion=true" \
      -d "{\"indices\":\"ftx-logs-*\",\"include_global_state\":false}" >/dev/null'
fi

# ── bring the stack back ──────────────────────────────────────────────────

say "starting the rest of the stack"
docker compose up -d >/dev/null

say "restore complete — check https://localhost/status (give it a minute)"
echo "  postgres: psql in and spot-check; the migrations job should no-op"
echo "  elasticsearch: Kibana -> Discover, ftx-logs-app-* data view"