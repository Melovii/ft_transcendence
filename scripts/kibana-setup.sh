#!/bin/sh
# One-shot Kibana setup (issue #61): creates the ftx-logs-app data view and
# imports the saved searches + logging dashboard from the repo, so a fresh
# `make up` yields a ready-to-use Discover (issue #56: configuration as
# code). Runs in a curl container on the `logging` network.
set -eu

# SERVER_BASEPATH=/kibana (compose) means every Kibana API route — the
# status endpoint included — is served under the /kibana prefix.
KIBANA="http://kibana:5601/kibana"
AUTH="elastic:${ELASTIC_PASSWORD}"

# Kibana finishes starting well after Elasticsearch reports healthy.
until curl -fs -o /dev/null -u "$AUTH" "$KIBANA/api/status" 2>/dev/null; do
  echo "kibana-setup: waiting for kibana..."
  sleep 5
done

# Data view over the ILM rollover indices — timestamp field @timestamp.
# Kibana 9 moved the create endpoint from /default to /data_view; override
# keeps the job idempotent — `make up` reruns it on every stack start.
curl -fs -u "$AUTH" -H 'Content-Type: application/json' -H 'kbn-xsrf: true' \
  -X POST "$KIBANA/api/data_views/data_view" -d '{
    "override": true,
    "data_view": {
      "id": "ftx-logs-app",
      "title": "ftx-logs-app-*",
      "timeFieldName": "@timestamp"
    }
  }'
echo "kibana-setup: data view ftx-logs-app created"

curl -fs -u "$AUTH" -H 'kbn-xsrf: true' \
  -X POST "$KIBANA/api/saved_objects/_import?createNewCopies=true" \
  --form "file=@/kibana/dashboards.ndjson"
echo "kibana-setup: saved searches and dashboard imported"