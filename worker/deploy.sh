#!/usr/bin/env bash
# Deploy the version service. Headless: wrangler with CLOUDFLARE_API_TOKEN read from ~/projects/cloudflare.env
# (never printed), the account id asked of the API when the file has none.  Usage: worker/deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
CREDS="$HOME/projects/cloudflare.env"
read_env() { [ -f "$1" ] || return 1; sed -n "s/^[[:space:]]*$2[[:space:]]*=[[:space:]]*//p" "$1" | head -1 | tr -d '"' | tr -d "'" | tr -d '\r'; }
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then CLOUDFLARE_API_TOKEN=$(read_env "$CREDS" CLOUDFLARE_API_TOKEN || true); export CLOUDFLARE_API_TOKEN; fi
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || { echo "no CLOUDFLARE_API_TOKEN" >&2; exit 1; }
if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then CLOUDFLARE_ACCOUNT_ID=$(read_env "$CREDS" CLOUDFLARE_ACCOUNT_ID || true); fi
if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  CLOUDFLARE_ACCOUNT_ID=$(curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" https://api.cloudflare.com/client/v4/accounts | sed -n 's/.*"id":"\([a-f0-9]\{32\}\)".*/\1/p' | head -1)
fi
[ -n "$CLOUDFLARE_ACCOUNT_ID" ] || { echo "could not read an account id" >&2; exit 1; }
export CLOUDFLARE_ACCOUNT_ID
npx --yes wrangler@4 deploy ${WRANGLER_CONFIG:+-c "$WRANGLER_CONFIG"} 2>&1 | tee /tmp/vt-worker-deploy.log | tail -12
grep -oE 'https://[a-z0-9.-]+\.workers\.dev' /tmp/vt-worker-deploy.log | head -1
