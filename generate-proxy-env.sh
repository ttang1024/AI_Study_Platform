#!/usr/bin/env bash
# Converts Webshare proxy list (host:port:user:pass) to YouTube__ProxyUrl env var.
# Usage: ./generate-proxy-env.sh [proxy-file] [count]
#   proxy-file  default: Webshare_residential_proxies.txt
#   count       max proxies to include (default: 100)

PROXY_FILE="${1:-Webshare_residential_proxies.txt}"
MAX="${2:-100}"

if [[ ! -f "$PROXY_FILE" ]]; then
  echo "Error: $PROXY_FILE not found" >&2
  exit 1
fi

urls=""
n=0
while IFS=: read -r host port user pass; do
  [[ -z "$host" ]] && continue
  (( n >= MAX )) && break
  pass="${pass//$'\r'/}"  # strip Windows carriage returns
  url="http://${user}:${pass}@${host}:${port}"
  urls="${urls:+$urls,}$url"
  (( n++ ))
done < "$PROXY_FILE"

ENV_FILE=".azure_env_variables"

# Remove any existing YouTube__ProxyUrl line then append the new one
if [[ -f "$ENV_FILE" ]]; then
  grep -v "^export YouTube__ProxyUrl=" "$ENV_FILE" > "${ENV_FILE}.tmp" && mv "${ENV_FILE}.tmp" "$ENV_FILE"
fi
# Collapse any accidental newlines so the value is always a single line
urls="${urls//$'\n'/}"
printf 'export YouTube__ProxyUrl=%s\n' "$urls" >> "$ENV_FILE"

echo "# $n proxies written to $ENV_FILE" >&2
