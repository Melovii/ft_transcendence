# Nightly backup runner (roadmap Phase 1): pg_dumpall of the shared
# instance + Elasticsearch snapshots into the `backups` volume.
# postgres:17-alpine for the client tools (matching the server major
# version); curl and jq to drive the snapshot API.
FROM postgres:17-alpine

RUN apk add --no-cache curl jq

COPY backup/backup.sh /backup.sh

ENTRYPOINT ["/backup.sh"]