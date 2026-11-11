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

# the stats page's secrets (Trix): its access key (made once, kept in ~/projects/violin-toolkit-stats.env, mode 600)
# and, when the read-only Analytics token is in cloudflare.env, that token and the account id. Never printed.
KEYF="$HOME/projects/violin-toolkit-stats.env"
if [ ! -f "$KEYF" ]; then umask 077; printf 'STATS_KEY=%s\n' "$(openssl rand -hex 24)" > "$KEYF"; fi
read_env "$KEYF" STATS_KEY | npx --yes wrangler@4 secret put STATS_KEY ${WRANGLER_CONFIG:+-c "$WRANGLER_CONFIG"} 2>&1 | tail -1
AT=$(read_env "$CREDS" CLOUDFLARE_ANALYTICS_TOKEN || true)
if [ -n "$AT" ]; then
  printf '%s' "$AT" | npx --yes wrangler@4 secret put CF_ANALYTICS_TOKEN ${WRANGLER_CONFIG:+-c "$WRANGLER_CONFIG"} 2>&1 | tail -1
  printf '%s' "$CLOUDFLARE_ACCOUNT_ID" | npx --yes wrangler@4 secret put CF_ACCOUNT_ID ${WRANGLER_CONFIG:+-c "$WRANGLER_CONFIG"} 2>&1 | tail -1
else echo "no CLOUDFLARE_ANALYTICS_TOKEN in cloudflare.env yet: the stats page says 'not connected'"; fi
