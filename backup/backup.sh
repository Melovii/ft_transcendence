#!/bin/sh
# Nightly backup runner (roadmap Phase 1). One container, two kinds of
# artifacts in the shared `backups` volume, which the status service
# watches read-only:
#   postgres      — pg_dumpall of the whole instance (roles + every
#                   database, not just one DB) as gzipped SQL, kept 7 days
#   elasticsearch — snapshots in the ftx-backups fs repository, kept 7
#                   days; ES writes those files itself under path.repo
#
# Every step guards with `|| return 1` before its success log: a failed
# backup must never be reported as written. Restores are NOT this
# script's job — scripts/restore.sh (docs/dr.md). A backup without a
# tested restore is a hope, not a control.
set -u

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${ELASTIC_PASSWORD:?ELASTIC_PASSWORD is required}"

PG_DIR=/backups/postgres
ES_DIR=/backups/elasticsearch
RETENTION_DAYS=7
ES=http://elasticsearch:9200
ES_AUTH=elastic:${ELASTIC_PASSWORD}
ES_REPO=ftx-backups

# Logging contract (docs/NEW-SERVICE.md §9): structured JSON on stdout.
log() {
  printf '{"time":"%s","level":"%s","msg":"%s","service":"backup-service"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2"
}

# Digits and dashes only: Elasticsearch snapshot names must be lowercase,
# so no 'T'/'Z' ISO-8601 markers here.
timestamp() { date -u +%Y%m%d-%H%M%S; }

backup_postgres() {
  stamp=$(timestamp)
  file="$PG_DIR/ftx-$stamp.sql.gz"

  # Dump to disk first, then compress: a pipeline would report gzip's
  # exit status, so a failed pg_dumpall could still "succeed" with a
  # truncated dump.
  PGPASSWORD="$POSTGRES_PASSWORD" pg_dumpall -h postgres -U "$POSTGRES_USER" \
    > "$PG_DIR/ftx-$stamp.sql" || return 1
  gzip "$PG_DIR/ftx-$stamp.sql" || return 1

  # An untested backup is a hope, not a control — at minimum, prove the
  # archive is a valid gzip stream.
  gzip -t "$file" || { rm -f "$file"; return 1; }
  log INFO "postgres dump written $(basename "$file")"
}

prune_postgres() {
  # find -mtime +6 is "more than 6 whole days old", i.e. a 7-day window.
  find "$PG_DIR" -name '*.sql.gz' -type f -mtime +$((RETENTION_DAYS - 1)) -delete
}

backup_elasticsearch() {
  # Idempotent: the repository must exist before the first snapshot.
  curl -fs -u "$ES_AUTH" -H 'Content-Type: application/json' \
    -X PUT "$ES/_snapshot/$ES_REPO" \
    -d '{"type":"fs","settings":{"location":"elasticsearch"}}' >/dev/null || return 1

  stamp=$(timestamp)
  curl -fs -u "$ES_AUTH" -X PUT \
    "$ES/_snapshot/$ES_REPO/snap-$stamp?wait_for_completion=true" >/dev/null || return 1
  log INFO "elasticsearch snapshot written snap-$stamp"
}

prune_elasticsearch() {
  cutoff_ms=$(( ($(date -u +%s) - RETENTION_DAYS * 86400) * 1000 ))
  curl -fs -u "$ES_AUTH" "$ES/_snapshot/$ES_REPO/_all" \
    | jq -r --argjson cutoff "$cutoff_ms" \
        '.snapshots[] | select(.start_time_in_millis < $cutoff) | .snapshot' \
    | while IFS= read -r snap; do
        curl -fs -u "$ES_AUTH" -X DELETE "$ES/_snapshot/$ES_REPO/$snap" >/dev/null \
          && log INFO "elasticsearch snapshot pruned $snap"
      done
}

run_backups() {
  # ES runs as uid 1000 and cannot create files in a root-owned volume
  # directory; its own entrypoint only chowns path.data. This container
  # runs as root, so it hands the snapshot directory over first.
  mkdir -p "$PG_DIR" "$ES_DIR"
  chown -R 1000:1000 "$ES_DIR"

  # One failed step must not stop the others — a nightly runner that
  # dies on the first error silently stops backing up everything else.
  for step in backup_postgres prune_postgres backup_elasticsearch prune_elasticsearch; do
    if ! "$step"; then
      log ERROR "$step failed"
    fi
  done
}

log INFO "backup service started (retention ${RETENTION_DAYS} days, nightly at 02:00 UTC)"
run_backups # a fresh artifact right away: the status page stops saying "never"

# Sleep until the next 02:00 UTC, then repeat. Plain arithmetic on
# seconds-of-day instead of date math: the 2h mark, wrap at midnight.
while :; do
  sec_of_day=$(( $(date -u +%s) % 86400 ))
  if [ "$sec_of_day" -lt 7200 ]; then
    sleep $(( 7200 - sec_of_day ))
  else
    sleep $(( 86400 - sec_of_day + 7200 ))
  fi
  run_backups
done