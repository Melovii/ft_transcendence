#!/usr/bin/env sh
# Generate a self-signed TLS certificate for local HTTPS.
# Phase 0 uses self-signed certs; production would use real ones (Let's Encrypt etc.).
set -eu

dir="$(cd "$(dirname "$0")/.." && pwd)"
cert_dir="$dir/certs"

mkdir -p "$cert_dir"

if [ -f "$cert_dir/server.crt" ] && [ -f "$cert_dir/server.key" ]; then
    echo "certs: $cert_dir/server.crt already exists, nothing to do"
    exit 0
fi

openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
    -keyout "$cert_dir/server.key" \
    -out "$cert_dir/server.crt" \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

chmod 600 "$cert_dir/server.key"

echo "certs: wrote $cert_dir/server.crt and $cert_dir/server.key"
echo "note: browsers will warn about the self-signed cert; accept it for local dev"