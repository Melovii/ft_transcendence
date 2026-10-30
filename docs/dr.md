# Disaster recovery: backups and restores

Phase 1 of the roadmap. This is the operational procedure for the two
questions that matter during an incident: what do we have, and how do we
get it back. An untested backup is a hope, not a control — every piece of
this document has been executed end to end (see "The drill" below).

## What is backed up

| Kind | What | Where | Cadence | Retention |
|---|---|---|---|---|
| Postgres | `pg_dumpall` of the whole instance: roles and every database (the auth DB and the `user` DB) | `backups/postgres/ftx-<UTC timestamp>.sql.gz` in the `backups` volume | Nightly at 02:00 UTC, plus once at container startup | 7 days |
| Elasticsearch | Snapshots into the `ftx-backups` fs repository — the `ftx-logs-*` indices and Kibana/system state | `backups/elasticsearch/` in the same volume (written by ES itself under `path.repo`) | Same schedule | 7 days |

The `backup` compose service (`backup/backup.sh`) does both. It sits on
the `db` and `logging` networks only — the things it backs up — and never
on `web`.

Not backed up:

- **Prometheus and Grafana state** — dashboards and alert rules are
  provisioned from `monitoring/` at every `make up`; metric history is
  operational telemetry, not data of record.
- **Postgres replication** — there is none; this is a single-node dev
  deployment. A real production setup would add streaming replication
  before it cared about RTO.

## Monitoring

The status service watches the `backups` volume read-only and exports
`platform_backup_age_seconds{kind}`; `-1` means the kind never produced an
artifact. Two alerts fire off that gauge (`monitoring/alerts.yml`):

- **BackupStale** (critical): no artifact newer than 26 h. The nightly
  job plus the startup run means a healthy system refreshes both kinds
  well inside that window; the 2-hour grace absorbs a slow night.
- **PostgresDown** (critical): the status service's probe of postgres
  reports it down for 5 minutes — the incident that precedes a restore.

Public view: `https://localhost/status` shows both backup ages, and the
Prometheus UI (`/prometheus`) shows the alerts.

## Restoring

`make restore` (→ `scripts/restore.sh`) restores both kinds, newest
artifact first:

1. Finds the newest dump and snapshot, and **fails before destroying
   anything** if there is no dump.
2. Asks for confirmation (`FORCE=1` to skip — for drills and scripts).
3. Stops the database writers (auth-service, user-service) and wipes the
   `pgdata` volume; elasticsearch and the status service stay up.
4. Starts a fresh Postgres and replays the dump. The `auth` role and
   database already exist on a fresh instance — those two errors are
   expected and harmless.
5. Deletes the snapshot's `ftx-logs-*` indices by **explicit name** (ES
   blocks wildcard deletes by default, `action.destructive_requires_name`)
   and restores them from the newest snapshot. System indices
   (`.kibana*`, `.security-*`, …) are left alone: the live ones exist and
   are not ours to clobber.
6. Brings the stack back up. The restore replays `schema_migrations`, so
   the migrate job is a no-op unless migrations landed after the dump —
   in which case they apply normally, which is the desired behavior.

Verify afterwards: `https://localhost/status` shows UP, `make psql`
spot-checks rows, Kibana's Discover view has the `ftx-logs-app-*` data.

## RTO / RPO

- **RPO** (how much data can be lost): up to 24 h. Backups are nightly;
  there is no continuous archiving (WAL shipping) in this project. All
  writes since the last 02:00 UTC dump are lost in a Postgres wipe.
- **RTO** (how long to recover): minutes, not hours. The drill below —
  wipe, replay, snapshot restore, full stack back UP — takes about two
  minutes on a dev machine. Real incident recovery adds diagnosis time,
  which is why the status page and alerts exist.

## The drill

A restore that has never been run is documentation, not a procedure. The
full drill was executed on 2026-10-30 (see the backup commit's message):
`FORCE=1 make restore` wiped `pgdata`, replayed the dump — the auth DB
came back with its user rows and `schema_migrations` at the recorded
version, the `user` DB came back with all of its tables — and restored
the log indices with the write alias intact. New logs flowed into the
restored index immediately after.

Re-run the drill after any change to the backup stack (backup.sh,
compose volumes, ES repository setup), and note the date here.

## Ransomware reality check

The `backups` volume is reachable and deletable by anything that owns the
Docker socket — including ransomware on the host. That is acceptable for
a development project; it is not for production. Real-world rules, in
order of importance:

1. **Immutable/offline copies**: ransomware deletes reachable backups
   first. A backup volume mounted `rw` is not a recovery mechanism
   against it.
2. **Test the restore**, not the backup: the drill above is the only
   proof.
3. **Least privilege**: the backup service holds the Postgres and
   Elasticsearch credentials, so it lives on internal networks only.