#!/usr/bin/env bash
# Encodes cookies files to base64 and upserts YouTube__CookiesList__N entries
# into .env_variables.
# Usage: ./generate-cookies-env.sh [cookies1.txt cookies2.txt ...]
# Defaults to cookies1.txt cookies2.txt cookies3.txt

ENV_FILE=".env_variables"
COOKIE_FILES=("${@:-cookies1.txt cookies2.txt cookies3.txt}")

# When no args given, bash keeps the default as one word — fix that
if [[ $# -eq 0 ]]; then
  COOKIE_FILES=(cookies1.txt cookies2.txt cookies3.txt)
fi

# Validate all cookie files exist before touching the env file
for f in "${COOKIE_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "Error: $f not found" >&2
    exit 1
  fi
done

# Remove any existing YouTube__CookiesList__ lines from the env file
if [[ -f "$ENV_FILE" ]]; then
  grep -v "YouTube__CookiesList__" "$ENV_FILE" > "${ENV_FILE}.tmp" && mv "${ENV_FILE}.tmp" "$ENV_FILE"
fi

# Append new entries
idx=0
for f in "${COOKIE_FILES[@]}"; do
  b64=$(base64 < "$f" | tr -d '\n')
  echo "export YouTube__CookiesList__${idx}=${b64}" >> "$ENV_FILE"
  echo "  [${idx}] $f → YouTube__CookiesList__${idx} (${#b64} chars)" >&2
  (( idx++ ))
done

echo "Done: $idx cookie set(s) written to $ENV_FILE" >&2
