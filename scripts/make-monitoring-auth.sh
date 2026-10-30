#!/bin/sh
# Generates certs/prometheus.htpasswd — the nginx basic-auth file guarding the
# Prometheus UI route (issue #78). Reads PROMETHEUS_USER / PROMETHEUS_PASSWORD
# from .env; the hash never enters git (certs/ is gitignored).
set -eu

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "monitoring-auth: .env not found — copy .env.example to .env first" >&2
  exit 1
fi

user=$(grep -E '^PROMETHEUS_USER=' .env | cut -d= -f2-)
pass=$(grep -E '^PROMETHEUS_PASSWORD=' .env | cut -d= -f2-)

if [ -z "$user" ] || [ -z "$pass" ]; then
  echo "monitoring-auth: set PROMETHEUS_USER and PROMETHEUS_PASSWORD in .env" >&2
  exit 1
fi

mkdir -p certs
# -apr1 selects the nginx-compatible MD5-crypt hash format.
printf '%s:%s\n' "$user" "$(openssl passwd -apr1 "$pass")" > certs/prometheus.htpasswd
chmod 600 certs/prometheus.htpasswd
echo "monitoring-auth: wrote certs/prometheus.htpasswd (user: $user)"