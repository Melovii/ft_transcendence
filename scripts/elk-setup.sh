#!/bin/sh
# One-shot ELK setup (issues #56–63): ILM policies, index templates and
# least-privilege service accounts. Runs in a curl container on the internal
# `logging` network, authenticated as the generated `elastic` superuser.
# After this job the superuser stays for emergencies only — Logstash and
# Kibana get dedicated low-privilege users (issue #63).
set -eu

ES="http://elasticsearch:9200"
AUTH="elastic:${ELASTIC_PASSWORD}"

# Elasticsearch may still be booting when compose starts this job.
until curl -fs -u "$AUTH" "$ES/_cluster/health?wait_for_status=yellow&timeout=10s" >/dev/null 2>&1; do
  echo "elk-setup: waiting for elasticsearch..."
  sleep 3
done

# ── ILM (issue #62) ──────────────────────────────────────────────────────────
# Application logs: roll over daily / at 10 GB per primary shard, delete 30
# days after rollover.
curl -fs -u "$AUTH" -H 'Content-Type: application/json' \
  -X PUT "$ES/_ilm/policy/ftx-logs" -d '{
    "policy": {
      "phases": {
        "hot": {
          "min_age": "0ms",
          "actions": { "rollover": { "max_age": "1d", "max_primary_shard_size": "10gb" } }
        },
        "delete": {
          "min_age": "30d",
          "actions": { "delete": {} }
        }
      }
    }
  }'
echo "elk-setup: ILM policy ftx-logs (rollover 1d/10gb, delete 30d)"

# Raw and dead-letter logs have no rollover alias — a delete-only policy with
# the same 30-day retention.
curl -fs -u "$AUTH" -H 'Content-Type: application/json' \
  -X PUT "$ES/_ilm/policy/ftx-logs-static" -d '{
    "policy": {
      "phases": {
        "delete": { "min_age": "30d", "actions": { "delete": {} } }
      }
    }
  }'
echo "elk-setup: ILM policy ftx-logs-static (delete 30d)"

# ── index templates ──────────────────────────────────────────────────────────
# The ftx- prefix keeps us out of Elastic's reserved `logs-*-*` namespace:
# ES 9 ships a built-in template there that force-creates data streams, which
# would reject the classic rollover-alias ILM used here.
curl -fs -u "$AUTH" -H 'Content-Type: application/json' \
  -X PUT "$ES/_index_template/ftx-logs-app" -d '{
    "index_patterns": ["ftx-logs-app-*"],
    "template": {
      "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "index.lifecycle.name": "ftx-logs",
        "index.lifecycle.rollover_alias": "ftx-logs-app"
      }
    }
  }'
echo "elk-setup: index template ftx-logs-app-*"

curl -fs -u "$AUTH" -H 'Content-Type: application/json' \
  -X PUT "$ES/_index_template/ftx-logs-static" -d '{
    "index_patterns": ["ftx-logs-raw-*", "ftx-logs-deadletter-*"],
    "template": {
      "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "index.lifecycle.name": "ftx-logs-static"
      }
    }
  }'
echo "elk-setup: index template ftx-logs-raw-*/ftx-logs-deadletter-*"

# Bootstrap the rollover alias (issue #62): the write alias must exist before
# Logstash starts, with a concrete first index for it to point at. The ILM
# policy (attached via the template) then rolls ftx-logs-app-000001 over to
# -000002 on the 1d/10gb boundary and moves the alias itself.
if ! curl -fs -o /dev/null -u "$AUTH" "$ES/_alias/ftx-logs-app"; then
  curl -fs -u "$AUTH" -H 'Content-Type: application/json' \
    -X PUT "$ES/ftx-logs-app-000001" -d '{
      "aliases": { "ftx-logs-app": { "is_write_index": true } }
    }'
  echo "elk-setup: rollover alias ftx-logs-app -> ftx-logs-app-000001"
fi

# ── least-privilege service accounts (issue #63) ─────────────────────────────
# Logstash may only manage and write log indices — nothing else.
curl -fs -u "$AUTH" -H 'Content-Type: application/json' \
  -X PUT "$ES/_security/role/logstash_writer" -d '{
    "cluster": ["manage_index_templates", "manage_ilm", "monitor"],
    "indices": [
      { "names": ["ftx-logs-*"], "privileges": ["create_index", "index", "write", "manage"] }
    ]
  }'

curl -fs -u "$AUTH" -H 'Content-Type: application/json' \
  -X PUT "$ES/_security/user/logstash_writer" -d '{
    "password": "'"${LOGSTASH_PASSWORD}"'",
    "roles": ["logstash_writer"]
  }'
echo "elk-setup: logstash_writer user (ftx-logs-* only)"

# kibana_system is a reserved built-in user: only its password may be
# changed, and only through the dedicated _password endpoint.
curl -fs -u "$AUTH" -H 'Content-Type: application/json' \
  -X PUT "$ES/_security/user/kibana_system/_password" -d '{
    "password": "'"${KIBANA_SYSTEM_PASSWORD}"'"
  }'
echo "elk-setup: kibana_system password set"

echo "elk-setup: done"