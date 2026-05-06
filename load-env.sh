#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.azure_env_variables"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found" >&2
  exit 1
fi

# shellcheck source=.azure_env_variables
source "$ENV_FILE"
echo "Azure environment variables loaded."

# source ./load-env.sh
