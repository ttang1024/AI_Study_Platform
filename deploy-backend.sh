#!/bin/bash
set -euo pipefail

# Redeploy the AWS API/backend. This reuses resources created by deploy.sh.
DEPLOY_BACKEND_ONLY=1 exec "$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)/deploy.sh"
