#!/bin/sh
# One-shot job: create the user-service database on the shared PostgreSQL
# instance if it does not exist yet (one database per service,
# docs/NEW-SERVICE.md). Runs in its own container on the `db` network;
# user-service applies its own migrations at startup (MIGRATE_ON_START), so
# this script never touches schemas.
set -eu

# Connect over TCP to the shared instance (the local socket in this
# container has no server behind it).
export PGHOST=postgres
export PGPASSWORD="$POSTGRES_PASSWORD"

if psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
    "SELECT 1 FROM pg_database WHERE datname = 'user'" | grep -q 1; then
  echo "init-user-db: database 'user' already exists"
else
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c 'CREATE DATABASE "user"'
  echo "init-user-db: created database 'user'"
fi