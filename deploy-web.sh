#!/bin/bash
set -euo pipefail

# Redeploy static AWS web/admin frontends. The full deploy script is the source
# of truth for discovering the CloudFront API URL and S3 bucket names.
DEPLOY_WEB_ONLY=1 exec "$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)/deploy.sh"
