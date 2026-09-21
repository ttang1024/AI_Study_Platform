#!/bin/bash
set -euo pipefail

# AWS deployment:
# - API: a single Lightsail instance running the container from ECR, fronted by CloudFront.
#   (Was ECS Fargate behind an ALB until 2026-09-21; that cost ~$54/month in compute, load
#   balancer hours and public IPv4 addresses for a box that idles at 0.5% CPU. The Lightsail
#   bundle is a flat $12 and includes its own transfer allowance.)
# - Web/Admin: S3 static websites behind CloudFront.
# - Documents: private S3 bucket.
# - Database: external managed PostgreSQL (Supabase) over TLS — nothing database-shaped is
#   provisioned in AWS.
# - Cache: none. Redis is optional and off by default; set REDIS_ENABLED/REDIS_CONNECTION_STRING to
#   point the API at one you already run.
#
# DEPLOY_WEB_ONLY=1      rebuild and resync the frontends only (see deploy-web.sh)
# DEPLOY_BACKEND_ONLY=1  build, push and roll the API only (see deploy-backend.sh)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.env_variables" ]]; then
  # shellcheck source=.env_variables
  source "$SCRIPT_DIR/.env_variables"
fi

# ---------------------------------------------------------------- helpers ---

# aws ... but an API error or a "None" result becomes the empty string, for the
# describe-then-create-if-missing pattern used throughout.
aws_opt() {
  local out
  out="$(aws "$@" 2>/dev/null || true)"
  [[ "$out" == "None" ]] && out=""
  printf '%s' "$out"
}

strip_cr() { printf '%s' "$1" | tr -d '\r'; }

bucket_name() {
  printf '%s-%s-%s-%s' "$APP_NAME" "$1" "$AWS_REGION" "$AWS_ACCOUNT_ID" | tr '[:upper:]' '[:lower:]' | tr '_' '-'
}

ensure_bucket() {
  local bucket="$1" attempt
  local create=(aws s3api create-bucket --bucket "$bucket")
  if [[ "$AWS_REGION" != "us-east-1" ]]; then
    create+=(--create-bucket-configuration "LocationConstraint=$AWS_REGION")
  fi

  for attempt in {1..30}; do
    if aws s3api head-bucket --bucket "$bucket" >/dev/null 2>&1; then
      echo "    Bucket $bucket already exists"
      return
    fi
    "${create[@]}" >/dev/null 2>&1 && return
    echo "    Bucket $bucket is not ready yet, retrying ($attempt/30)"
    sleep 10
  done

  echo "Failed to create bucket $bucket after retries" >&2
  return 1
}

ensure_website_bucket() {
  local bucket="$1"
  ensure_bucket "$bucket"
  aws s3 website "s3://$bucket" --index-document index.html --error-document index.html >/dev/null
  aws s3api put-public-access-block --bucket "$bucket" \
    --public-access-block-configuration BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false >/dev/null
  aws s3api put-bucket-policy --bucket "$bucket" --policy "$(jq -nc --arg arn "arn:aws:s3:::$bucket/*" '{
    Version: "2012-10-17",
    Statement: [{Sid: "PublicReadStaticWebsite", Effect: "Allow", Principal: "*", Action: "s3:GetObject", Resource: $arn}]
  }')" >/dev/null
}

cloudfront_field_by_comment() {
  aws_opt cloudfront list-distributions --query "DistributionList.Items[?Comment=='$1'].$2 | [0]" --output text
}

# ensure_cloudfront <comment> <origin domain> <static|api>. Prints the https origin, creating the
# distribution when no distribution carries that comment yet. "static" caches and rewrites 403/404 to
# index.html for the SPA; "api" forwards everything and caches nothing.
ensure_cloudfront() {
  local comment="$1" origin="$2" kind="$3" domain config
  domain="$(cloudfront_field_by_comment "$comment" DomainName)"
  if [[ -n "$domain" ]]; then
    printf 'https://%s\n' "$domain"
    return
  fi

  config="$(jq -nc --arg ref "${comment}-$(date +%s)" --arg comment "$comment" --arg origin "$origin" --arg kind "$kind" '
    ($kind == "api") as $api |
    {
      CallerReference: $ref,
      Comment: $comment,
      Enabled: true,
      PriceClass: "PriceClass_100",
      Origins: {Quantity: 1, Items: [{
        Id: $origin,
        DomainName: $origin,
        CustomOriginConfig: {
          HTTPPort: 80,
          HTTPSPort: 443,
          OriginProtocolPolicy: "http-only",
          OriginReadTimeout: (if $api then 60 else 30 end),
          OriginKeepaliveTimeout: (if $api then 60 else 5 end),
          OriginSslProtocols: {Quantity: 1, Items: ["TLSv1.2"]}
        }
      }]},
      DefaultCacheBehavior: {
        TargetOriginId: $origin,
        ViewerProtocolPolicy: "redirect-to-https",
        Compress: true,
        TrustedSigners: {Enabled: false, Quantity: 0},
        AllowedMethods: ((if $api
          then {Quantity: 7, Items: ["GET","HEAD","OPTIONS","PUT","PATCH","POST","DELETE"]}
          else {Quantity: 3, Items: ["GET","HEAD","OPTIONS"]} end)
          + {CachedMethods: {Quantity: 2, Items: ["GET","HEAD"]}}),
        ForwardedValues: (if $api
          then {QueryString: true, Cookies: {Forward: "all"}, Headers: {Quantity: 1, Items: ["*"]}}
          else {QueryString: false, Cookies: {Forward: "none"}} end),
        MinTTL: 0,
        DefaultTTL: (if $api then 0 else 300 end),
        MaxTTL: (if $api then 0 else 86400 end)
      },
      Restrictions: {GeoRestriction: {RestrictionType: "none", Quantity: 0}},
      ViewerCertificate: {CloudFrontDefaultCertificate: true}
    } + (if $api then {} else {
      DefaultRootObject: "index.html",
      CustomErrorResponses: {Quantity: 2, Items: [
        {ErrorCode: 403, ResponsePagePath: "/index.html", ResponseCode: "200", ErrorCachingMinTTL: 0},
        {ErrorCode: 404, ResponsePagePath: "/index.html", ResponseCode: "200", ErrorCachingMinTTL: 0}
      ]}
    } end)')"

  domain="$(aws cloudfront create-distribution --distribution-config "$config" --query 'Distribution.DomainName' --output text)" || domain=""
  if [[ -z "$domain" || "$domain" == "None" ]]; then
    echo "create-distribution failed for '$comment' (see the AWS error above); refusing to continue with an empty origin." >&2
    exit 1
  fi
  printf 'https://%s\n' "$domain"
}

# ensure_share_preview_behavior <api origin host>. Points /share/* on the web distribution at the API
# instead of the S3 bucket, and is a no-op once that behavior exists.
#
# Why: /share/{token} is a client-rendered route, so a crawler served the S3 index.html sees the
# landing page's card and every shared link unfurls identically on Slack, X, LinkedIn and WeChat.
# The API renders the same shell with that share's title, summary snippet and contents already in
# the meta tags (SharePreviewController), so the app still boots exactly as before — the crawler
# just gets something to read. Everything outside /share/* keeps coming from S3.
ensure_share_preview_behavior() {
  local origin_host="$1" dist_id etag config updated config_file
  dist_id="$(cloudfront_field_by_comment "$WEB_CLOUDFRONT_COMMENT" Id)"
  if [[ -z "$dist_id" || "$dist_id" == "None" ]]; then
    echo "    Web distribution not found by comment '$WEB_CLOUDFRONT_COMMENT'; skipping the /share/* behavior." >&2
    return 0
  fi

  config_file="$(mktemp -t share-behavior)"
  if ! aws cloudfront get-distribution-config --id "$dist_id" > "$config_file" 2>/dev/null; then
    echo "    Could not read the web distribution config; skipping the /share/* behavior." >&2
    rm -f "$config_file"
    return 0
  fi
  etag="$(jq -r '.ETag' "$config_file")"
  config="$(jq '.DistributionConfig' "$config_file")"

  if jq -e --arg origin "$origin_host" '
      (.CacheBehaviors.Items // []) | any(.PathPattern == "/share/*" and .TargetOriginId == $origin)
    ' <<<"$config" >/dev/null; then
    echo "    /share/* already routed to the API"
    rm -f "$config_file"
    return 0
  fi

  # The API is reached at its own origin host rather than through its CloudFront distribution:
  # one hop, and the same origin settings that distribution uses.
  updated="$(jq --arg origin "$origin_host" '
    .Origins.Items |= (map(select(.Id != $origin)) + [{
      Id: $origin,
      DomainName: $origin,
      OriginPath: "",
      CustomHeaders: {Quantity: 0},
      CustomOriginConfig: {
        HTTPPort: 80,
        HTTPSPort: 443,
        OriginProtocolPolicy: "http-only",
        OriginReadTimeout: 30,
        OriginKeepaliveTimeout: 5,
        OriginSslProtocols: {Quantity: 1, Items: ["TLSv1.2"]}
      }
    }])
    | .Origins.Quantity = (.Origins.Items | length)
    | .CacheBehaviors.Items = ((.CacheBehaviors.Items // []) | map(select(.PathPattern != "/share/*")) + [{
        PathPattern: "/share/*",
        TargetOriginId: $origin,
        ViewerProtocolPolicy: "redirect-to-https",
        Compress: true,
        TrustedSigners: {Enabled: false, Quantity: 0},
        AllowedMethods: {
          Quantity: 3,
          Items: ["GET", "HEAD", "OPTIONS"],
          CachedMethods: {Quantity: 2, Items: ["GET", "HEAD"]}
        },
        # No headers or cookies forwarded: the page is the same for every visitor, which is what
        # makes it cacheable at the edge. The API sets no-store for a token that does not resolve.
        ForwardedValues: {
          QueryString: false,
          Cookies: {Forward: "none"},
          Headers: {Quantity: 0},
          QueryStringCacheKeys: {Quantity: 0}
        },
        MinTTL: 0,
        DefaultTTL: 300,
        MaxTTL: 3600,
        SmoothStreaming: false,
        FieldLevelEncryptionId: "",
        LambdaFunctionAssociations: {Quantity: 0}
      }])
    | .CacheBehaviors.Quantity = (.CacheBehaviors.Items | length)
  ' <<<"$config")"

  printf '%s' "$updated" > "$config_file"
  if aws cloudfront update-distribution --id "$dist_id" --if-match "$etag" \
      --distribution-config "file://$config_file" >/dev/null; then
    echo "    /share/* now rendered by the API (social link previews)"
    aws cloudfront create-invalidation --distribution-id "$dist_id" --paths '/share/*' >/dev/null || true
  else
    echo "    Failed to add the /share/* behavior to the web distribution; share links will still" >&2
    echo "    work but will unfurl with the generic landing-page card." >&2
  fi
  rm -f "$config_file"
}

invalidate_cloudfront_by_comment() {
  local id
  id="$(cloudfront_field_by_comment "$1" Id)"
  if [[ -n "$id" ]]; then
    aws cloudfront create-invalidation --distribution-id "$id" --paths '/*' >/dev/null
  fi
}

# https://<sub>.<PUBLIC_DOMAIN>, or empty when no custom domain is configured.
domain_origin() {
  [[ -n "$PUBLIC_DOMAIN" ]] && echo "https://$1.$PUBLIC_DOMAIN" || echo ""
}

# Resolves the four public origins, creating whichever CloudFront distributions are missing, and sets
# WEB_ORIGIN, ADMIN_ORIGIN, WEB_WWW_ORIGIN and API_URL. An explicit *_PUBLIC_ORIGIN always wins, and
# PUBLIC_DOMAIN derives the api./admin./www. hostnames — see the PUBLIC_DOMAIN note below.
resolve_public_origins() {
  local api_origin_host="$1" website_suffix="s3-website-$AWS_REGION.amazonaws.com" admin api
  admin="${ADMIN_PUBLIC_ORIGIN:-$(domain_origin admin)}"
  api="${API_PUBLIC_ORIGIN:-$(domain_origin api)}"
  WEB_ORIGIN="${WEB_PUBLIC_ORIGIN:-$(ensure_cloudfront "$WEB_CLOUDFRONT_COMMENT" "$WEB_BUCKET.$website_suffix" static)}"
  ADMIN_ORIGIN="${admin:-$(ensure_cloudfront "$ADMIN_CLOUDFRONT_COMMENT" "$ADMIN_BUCKET.$website_suffix" static)}"
  API_URL="${api:-$(ensure_cloudfront "$API_CLOUDFRONT_COMMENT" "$api_origin_host" api)}"
  if [[ -n "$PUBLIC_DOMAIN" && "$WEB_ORIGIN" == "https://$PUBLIC_DOMAIN" ]]; then
    WEB_WWW_ORIGIN="${WEB_WWW_PUBLIC_ORIGIN:-https://www.$PUBLIC_DOMAIN}"
  else
    WEB_WWW_ORIGIN="${WEB_WWW_PUBLIC_ORIGIN:-$WEB_ORIGIN}"
  fi
}

# Uploads a built frontend to its bucket. Hashed files under assets/ are NEVER pruned by the same
# run that uploads their replacements: an already-open browser tab, and the API's cached copy of
# index.html (WebAppShellProvider caches it for 5 minutes, so /share/{token} keeps quoting the old
# filenames right after a deploy), both still ask for the *previous* build's chunks. The website
# bucket rewrites a miss to index.html with a 200, so a deleted chunk does not 404 — it comes back
# as HTML and the browser refuses it ("Expected a JavaScript-or-Wasm module script but the server
# responded with a MIME type of text/html"). Leaving the old chunks in place makes a stale shell
# boot the old build instead of breaking.
#
# New assets go up before index.html so the shell never points at a chunk that is not there yet;
# everything outside assets/ is still pruned. Superseded chunks are cleaned up on a later run, once
# they are old enough that nothing can still be holding a reference (see prune_stale_assets).
sync_frontend() {
  local dist="$1" bucket="$2"
  aws s3 sync "$dist/assets" "s3://$bucket/assets"
  aws s3 sync "$dist" "s3://$bucket" --delete --exclude 'assets/*'
  prune_stale_assets "$dist" "$bucket"
}

# Deletes assets/ objects that this build did not produce and that are older than ASSET_RETENTION_DAYS,
# so the bucket does not grow by a build every deploy. The age check is what makes it safe: the
# previous build is minutes old and always survives, and an unchanged chunk keeps being re-uploaded
# by `aws s3 sync` only when its content changes — so it is matched by name here, never by age.
ASSET_RETENTION_DAYS="${ASSET_RETENTION_DAYS:-7}"
prune_stale_assets() {
  local dist="$1" bucket="$2" cutoff key modified
  # No zone suffix on either side: LastModified comes back as 2026-09-16T02:10:33+00:00 and the
  # comparison below is lexicographic, so both have to stop at the seconds.
  cutoff="$(date -u -v-"${ASSET_RETENTION_DAYS}"d +%Y-%m-%dT%H:%M:%S 2>/dev/null \
    || date -u -d "${ASSET_RETENTION_DAYS} days ago" +%Y-%m-%dT%H:%M:%S)"
  while read -r key modified; do
    [[ -z "$key" || -z "$modified" || "$key" == "None" ]] && continue
    [[ -e "$dist/$key" ]] && continue          # still part of the current build
    [[ "${modified:0:19}" > "$cutoff" ]] && continue  # ISO-8601 UTC sorts lexicographically
    aws s3 rm "s3://$bucket/$key" >/dev/null
    echo "    pruned superseded asset $key"
  done < <(aws s3api list-objects-v2 --bucket "$bucket" --prefix assets/ \
    --query 'Contents[].[Key,LastModified]' --output text 2>/dev/null)
}

# Builds web and admin against the resolved origins, syncs each to its bucket and invalidates its
# distribution. VITE_* values are baked in at build time, so this must run after the origins exist.
deploy_frontends() {
  echo "==> Building web frontend"
  (
    cd web
    npm ci
    VITE_API_URL="$API_URL" \
    VITE_SHARE_BASE_URL="$WEB_ORIGIN" \
    VITE_GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
    VITE_GITHUB_CLIENT_ID="$GITHUB_CLIENT_ID" \
    VITE_GOOGLE_SITE_VERIFICATION="$GOOGLE_SITE_VERIFICATION" \
    npm run build
    # robots.txt and sitemap.xml are emitted by the build itself (web/vite-plugin-seo.ts), which
    # reads VITE_SHARE_BASE_URL — they are not written here.
  )
  sync_frontend web/dist "$WEB_BUCKET"
  invalidate_cloudfront_by_comment "$WEB_CLOUDFRONT_COMMENT"

  echo "==> Building admin frontend"
  (
    cd admin
    npm ci
    VITE_API_URL="$API_URL" npm run build
    # The admin dashboard is an internal tool on its own origin. Nothing links to it, but the bucket
    # is public, so keep it out of search indexes explicitly rather than relying on obscurity.
    cat > dist/robots.txt <<EOF
User-agent: *
Disallow: /
EOF
  )
  sync_frontend admin/dist "$ADMIN_BUCKET"
  invalidate_cloudfront_by_comment "$ADMIN_CLOUDFRONT_COMMENT"
}

summary() {
  echo ""
  echo "$1"
  echo "  Web:   $WEB_ORIGIN"
  echo "  Admin: $ADMIN_ORIGIN"
  echo "  API:   $API_URL"
}

# ---------------------------------------------------------- configuration ---

APP_NAME="${APP_NAME:-study-platform}"
AWS_REGION="${AWS_REGION:-ap-southeast-2}"
export AWS_DEFAULT_REGION="$AWS_REGION"
DEPLOY_WEB_ONLY="${DEPLOY_WEB_ONLY:-0}"
DEPLOY_BACKEND_ONLY="${DEPLOY_BACKEND_ONLY:-0}"

GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:?Set GOOGLE_CLIENT_ID env var}"
GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID:?Set GITHUB_CLIENT_ID env var}"
# Optional: the token from Search Console's "HTML tag" verification method (the content="..." value
# only). Unset simply omits the meta tag. Not needed if the property was verified via DNS instead.
GOOGLE_SITE_VERIFICATION="${GOOGLE_SITE_VERIFICATION:-}"
if [[ "$DEPLOY_WEB_ONLY" != "1" ]]; then
  # The one database credential this script handles, and it never leaves the container's env file.
  DATABASE_CONNECTION_STRING="${DATABASE_CONNECTION_STRING:?Set DATABASE_CONNECTION_STRING to the Supabase connection string (see DEPLOYMENT.md)}"
  JWT_SECRET="${JWT_SECRET:?Set JWT_SECRET env var}"
  GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:?Set GOOGLE_CLIENT_SECRET env var}"
  GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET:?Set GITHUB_CLIENT_SECRET env var}"
  SMTP_USER="${SMTP_USER:?Set SMTP_USER env var}"
  SMTP_PASSWORD="${SMTP_PASSWORD:?Set SMTP_PASSWORD env var}"
fi

DATABASE_MIGRATE_ON_STARTUP="${DATABASE_MIGRATE_ON_STARTUP:-true}"
EMAIL_PROVIDER="${EMAIL_PROVIDER:-Smtp}"
EMAIL_FROM="${EMAIL_FROM:-${SMTP_USER:-}}"
SES_REGION="${SES_REGION:-$AWS_REGION}"
# Semantic-search indexing key. Optional: without it EmbeddingBackfillWorker no-ops and search falls
# back to keyword results. It is a credential, so it travels as an environment variable, never in the
# image — server/.dockerignore keeps the developer's appsettings.json out of the build.
EMBEDDINGS_API_KEY="${EMBEDDINGS_API_KEY:-}"
YOUTUBE_PROXY_URL="${YOUTUBE_PROXY_URL:-${YouTube__ProxyUrl:-}}"
YOUTUBE_COOKIES_B64="${YOUTUBE_COOKIES_B64:-${YouTube__CookiesBase64:-}}"
# Custom domains are opt-in via PUBLIC_DOMAIN (e.g. PUBLIC_DOMAIN=toto-study.com), giving
# https://<domain>, https://www.<domain>, https://api.<domain> and https://admin.<domain>.
#
# Empty by default, and that default matters. With an API origin set, the script skips creating the
# API's CloudFront distribution and bakes that hostname into the frontend build — so pointed at a
# domain whose DNS and ACM certificate are not yet in this AWS account, the deploy reports success
# and the site is completely broken. Leave it unset for a first deploy, verify on the hostnames AWS
# hands out, then set it once DNS and the certificate are in place.
PUBLIC_DOMAIN="${PUBLIC_DOMAIN:-}"

# No ElastiCache is provisioned; these only reach the container, for a Redis you run yourself.
REDIS_ENABLED="${REDIS_ENABLED:-false}"
REDIS_CONNECTION_STRING="${REDIS_CONNECTION_STRING:-}"
REDIS_INSTANCE_NAME="${REDIS_INSTANCE_NAME:-StudyPlatform:}"

# One pass stripping any trailing CR a .env_variables file edited on Windows would otherwise smuggle
# into a header, a JWT secret or a connection string.
for __v in GOOGLE_CLIENT_ID GITHUB_CLIENT_ID JWT_SECRET GOOGLE_CLIENT_SECRET GITHUB_CLIENT_SECRET \
           SMTP_USER SMTP_PASSWORD EMAIL_PROVIDER EMAIL_FROM SES_REGION DATABASE_CONNECTION_STRING \
           EMBEDDINGS_API_KEY YOUTUBE_PROXY_URL YOUTUBE_COOKIES_B64 REDIS_ENABLED \
           REDIS_CONNECTION_STRING REDIS_INSTANCE_NAME PUBLIC_DOMAIN WEB_PUBLIC_ORIGIN \
           ADMIN_PUBLIC_ORIGIN WEB_WWW_PUBLIC_ORIGIN API_PUBLIC_ORIGIN \
           GOOGLE_SITE_VERIFICATION; do
  printf -v "$__v" '%s' "$(strip_cr "${!__v:-}")"
done
unset __v

# Lightsail bundles are x86_64, so the image must be too — and on an Apple-silicon Mac
# `docker build` produces linux/arm64 by default, which the instance cannot run at all
# ("exec format error" in the container logs, a healthy-looking deploy, a dead API).
DOCKER_BUILD_PLATFORM="${DOCKER_BUILD_PLATFORM:-linux/amd64}"

AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ECR_REPOSITORY="${ECR_REPOSITORY:-$APP_NAME-api}"
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY"
DOCS_BUCKET="${DOCS_BUCKET:-$(bucket_name documents)}"
WEB_BUCKET="${WEB_BUCKET:-$(bucket_name web)}"
ADMIN_BUCKET="${ADMIN_BUCKET:-$(bucket_name admin)}"
LIGHTSAIL_INSTANCE_NAME="${LIGHTSAIL_INSTANCE_NAME:-${APP_NAME}-api}"
API_IAM_USER_NAME="${API_IAM_USER_NAME:-${APP_NAME}-lightsail}"
LIGHTSAIL_SSH_USER="${LIGHTSAIL_SSH_USER:-ubuntu}"
LIGHTSAIL_SSH_KEY="${LIGHTSAIL_SSH_KEY:-$HOME/.ssh/study-platform-lightsail}"
# Where the container's env file and the persisted DataProtection keys live on the instance.
LIGHTSAIL_APP_DIR="${LIGHTSAIL_APP_DIR:-/opt/study-platform}"
# CloudFront needs a hostname for a custom origin, never a bare IP, so the instance's static IP
# is published as this A record and the distributions point at it. Changing the instance means
# repointing this record, not touching CloudFront.
API_ORIGIN_HOST="${API_ORIGIN_HOST:-origin.${PUBLIC_DOMAIN:-toto-study.com}}"
# Lightsail has no IAM roles, so the S3 (documents bucket) and SES permissions that used to come
# from the ECS task role now come from an IAM user's access key, read by the SDK's default
# credential chain inside the container.
LIGHTSAIL_AWS_ACCESS_KEY_ID="${LIGHTSAIL_AWS_ACCESS_KEY_ID:-}"
LIGHTSAIL_AWS_SECRET_ACCESS_KEY="${LIGHTSAIL_AWS_SECRET_ACCESS_KEY:-}"
API_CONTAINER_NAME="${API_CONTAINER_NAME:-api}"
API_CONTAINER_PORT="${API_CONTAINER_PORT:-5000}"
LOG_GROUP_NAME="${LOG_GROUP_NAME:-/ecs/${APP_NAME}-api}"
WEB_CLOUDFRONT_COMMENT="${WEB_CLOUDFRONT_COMMENT:-${APP_NAME}-web-cloudfront}"
ADMIN_CLOUDFRONT_COMMENT="${ADMIN_CLOUDFRONT_COMMENT:-${APP_NAME}-admin-cloudfront}"
API_CLOUDFRONT_COMMENT="${API_CLOUDFRONT_COMMENT:-${APP_NAME}-api-cloudfront}"
IMAGE_TAG="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)-$(date +%Y%m%d%H%M%S)"

# ------------------------------------------------------------------- web -----

if [[ "$DEPLOY_WEB_ONLY" == "1" ]]; then
  echo "==> Resolving public origins"
  resolve_public_origins "$API_ORIGIN_HOST"
  ensure_share_preview_behavior "$API_ORIGIN_HOST"
  deploy_frontends
  summary "Frontend deployment complete"
  exit 0
fi

# --------------------------------------------------------------- storage -----

echo "==> Creating S3 buckets"
ensure_bucket "$DOCS_BUCKET"
aws s3api put-bucket-encryption --bucket "$DOCS_BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' >/dev/null
ensure_website_bucket "$WEB_BUCKET"
ensure_website_bucket "$ADMIN_BUCKET"

echo "==> Building and pushing API image"
aws ecr describe-repositories --repository-names "$ECR_REPOSITORY" >/dev/null 2>&1 || \
  aws ecr create-repository --repository-name "$ECR_REPOSITORY" >/dev/null
if ! docker info >/dev/null 2>&1; then
  echo "Docker is not available. Start Docker Desktop (or a docker daemon) and re-run." >&2
  exit 1
fi
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
echo "    building for $DOCKER_BUILD_PLATFORM (host is $(uname -m))"
docker build --platform "$DOCKER_BUILD_PLATFORM" -t "$ECR_URI:$IMAGE_TAG" -t "$ECR_URI:latest" ./server
docker push "$ECR_URI:$IMAGE_TAG"
docker push "$ECR_URI:latest"

# ------------------------------------------------------------ iam/network ----

echo "==> Ensuring the API's IAM user"
# Lightsail instances cannot assume an IAM role the way an ECS task can, so the two permissions the
# container needs — the documents bucket and SES — hang off a plain IAM user whose access key is
# injected as AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY below. The key itself is created once, by
# hand, and lives in .env_variables; this script only keeps the policies in sync.
if [[ -z "$LIGHTSAIL_AWS_ACCESS_KEY_ID" || -z "$LIGHTSAIL_AWS_SECRET_ACCESS_KEY" ]]; then
  echo "Set LIGHTSAIL_AWS_ACCESS_KEY_ID and LIGHTSAIL_AWS_SECRET_ACCESS_KEY in .env_variables." >&2
  echo "They are the access key of the IAM user $API_IAM_USER_NAME; see DEPLOYMENT.md." >&2
  exit 1
fi
aws iam get-user --user-name "$API_IAM_USER_NAME" >/dev/null 2>&1 || \
  aws iam create-user --user-name "$API_IAM_USER_NAME" >/dev/null
aws iam put-user-policy --user-name "$API_IAM_USER_NAME" --policy-name "${APP_NAME}-documents-s3" \
  --policy-document "$(jq -nc --arg bucket "arn:aws:s3:::$DOCS_BUCKET" '{
    Version: "2012-10-17",
    Statement: [
      {Effect: "Allow", Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource: ($bucket + "/*")},
      {Effect: "Allow", Action: ["s3:ListBucket", "s3:GetBucketLocation"], Resource: $bucket}
    ]}')" >/dev/null
aws iam put-user-policy --user-name "$API_IAM_USER_NAME" --policy-name "${APP_NAME}-ses-email" \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["ses:SendEmail"],"Resource":"*"}]}' >/dev/null
# Pulling the image and shipping container logs are the instance's own jobs, not the app's, but they
# run under the same key: the Docker daemon reads it for the awslogs driver, and the deploy below
# pipes a short-lived ECR token over ssh.
aws iam put-user-policy --user-name "$API_IAM_USER_NAME" --policy-name "${APP_NAME}-ecr-logs" \
  --policy-document "$(jq -nc --arg repo "arn:aws:ecr:$AWS_REGION:$AWS_ACCOUNT_ID:repository/$ECR_REPOSITORY" \
    --arg logs "arn:aws:logs:$AWS_REGION:$AWS_ACCOUNT_ID:log-group:$LOG_GROUP_NAME:*" '{
    Version: "2012-10-17",
    Statement: [
      {Effect: "Allow", Action: "ecr:GetAuthorizationToken", Resource: "*"},
      {Effect: "Allow", Action: ["ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"], Resource: $repo},
      {Effect: "Allow", Action: ["logs:CreateLogStream", "logs:PutLogEvents"], Resource: $logs}
    ]}')" >/dev/null
echo "    IAM user ready: $API_IAM_USER_NAME"

# Nothing to provision for the database: it lives in Supabase and is reached over TLS. The connection
# string is passed straight through to the container's env file — never into the image, a file in
# the repo, or any frontend build.
echo "==> Using external managed PostgreSQL (Supabase)"
echo "    Database host: $(printf '%s' "$DATABASE_CONNECTION_STRING" | tr ';' '\n' | awk -F= 'tolower($1) ~ /^ *host *$/ {print $2}' | head -1)"
if printf '%s' "$DATABASE_CONNECTION_STRING" | grep -qiE '(^|;) *ssl *mode *= *disable'; then
  echo "DATABASE_CONNECTION_STRING disables TLS (SSL Mode=Disable). Supabase requires an encrypted connection." >&2
  exit 1
fi

# ------------------------------------------------------------- lightsail -----

echo "==> Resolving the Lightsail instance"
aws logs create-log-group --log-group-name "$LOG_GROUP_NAME" >/dev/null 2>&1 || true
LIGHTSAIL_IP="$(aws_opt lightsail get-instance --instance-name "$LIGHTSAIL_INSTANCE_NAME" --query 'instance.publicIpAddress' --output text)"
if [[ -z "$LIGHTSAIL_IP" ]]; then
  echo "Lightsail instance '$LIGHTSAIL_INSTANCE_NAME' was not found in $AWS_REGION." >&2
  echo "It is created once, by hand — see the Lightsail section of DEPLOYMENT.md." >&2
  exit 1
fi
if [[ ! -f "$LIGHTSAIL_SSH_KEY" ]]; then
  echo "SSH key $LIGHTSAIL_SSH_KEY not found; set LIGHTSAIL_SSH_KEY to the deploy key." >&2
  exit 1
fi
SSH=(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -i "$LIGHTSAIL_SSH_KEY" "$LIGHTSAIL_SSH_USER@$LIGHTSAIL_IP")
"${SSH[@]}" true || { echo "Cannot ssh to $LIGHTSAIL_IP with $LIGHTSAIL_SSH_KEY." >&2; exit 1; }
echo "    Instance ready: $LIGHTSAIL_INSTANCE_NAME ($LIGHTSAIL_IP)"

# The A record is what CloudFront actually points at, so a rebuilt instance is picked up here
# rather than by editing two distributions.
HOSTED_ZONE_ID="$(aws_opt route53 list-hosted-zones-by-name --dns-name "${PUBLIC_DOMAIN:-toto-study.com}" --query 'HostedZones[0].Id' --output text)"
HOSTED_ZONE_ID="${HOSTED_ZONE_ID##*/}"
if [[ -n "$HOSTED_ZONE_ID" ]]; then
  CURRENT_ORIGIN_IP="$(aws_opt route53 list-resource-record-sets --hosted-zone-id "$HOSTED_ZONE_ID" \
    --query "ResourceRecordSets[?Name=='${API_ORIGIN_HOST}.' && Type=='A'].ResourceRecords[0].Value | [0]" --output text)"
  if [[ "$CURRENT_ORIGIN_IP" != "$LIGHTSAIL_IP" ]]; then
    aws route53 change-resource-record-sets --hosted-zone-id "$HOSTED_ZONE_ID" --change-batch "$(jq -nc \
      --arg name "$API_ORIGIN_HOST" --arg ip "$LIGHTSAIL_IP" '{
        Comment: "API origin for CloudFront (Lightsail instance)",
        Changes: [{Action: "UPSERT", ResourceRecordSet: {Name: $name, Type: "A", TTL: 60, ResourceRecords: [{Value: $ip}]}}]
      }')" >/dev/null
    echo "    $API_ORIGIN_HOST -> $LIGHTSAIL_IP"
  fi
fi

echo "==> Resolving public origins"
resolve_public_origins "$API_ORIGIN_HOST"
ensure_share_preview_behavior "$API_ORIGIN_HOST"
echo "    Web:   $WEB_ORIGIN"
echo "    Admin: $ADMIN_ORIGIN"
echo "    API:   $API_URL"

API_ENVIRONMENT=(
  "ASPNETCORE_ENVIRONMENT=Production"
  "AWS__Region=$AWS_REGION"
  "S3__BucketName=$DOCS_BUCKET"
  "ConnectionStrings__DefaultConnection=$DATABASE_CONNECTION_STRING"
  "Database__MigrateOnStartup=$DATABASE_MIGRATE_ON_STARTUP"
  "JwtSettings__SecretKey=$JWT_SECRET"
  "JwtSettings__Issuer=Study Platform"
  "JwtSettings__Audience=Study Platform Users"
  "Redis__Enabled=$REDIS_ENABLED"
  "Redis__ConnectionString=$REDIS_CONNECTION_STRING"
  "Redis__InstanceName=$REDIS_INSTANCE_NAME"
  "Cache__DashboardStatsSeconds=${CACHE_DASHBOARD_STATS_SECONDS:-60}"
  "Cache__AnalyticsSummarySeconds=${CACHE_ANALYTICS_SUMMARY_SECONDS:-300}"
  "Cache__GeneratedResultSeconds=${CACHE_GENERATED_RESULT_SECONDS:-3600}"
  "AppLimits__DocumentUploadLimit=${DOCUMENT_UPLOAD_LIMIT:-10}"
  "AppLimits__AudioUploadLimit=${AUDIO_UPLOAD_LIMIT:-10}"
  "AppLimits__VideoUploadLimit=${VIDEO_UPLOAD_LIMIT:-10}"
  "YouTube__SubtitleLanguages=${YOUTUBE_SUBTITLE_LANGUAGES:-en.*,en}"
  "YouTube__ProxyUrl=$YOUTUBE_PROXY_URL"
  "YouTube__CookiesBase64=$YOUTUBE_COOKIES_B64"
  "YouTube__HttpTimeoutSeconds=${YOUTUBE_HTTP_TIMEOUT_SECONDS:-60}"
  "GoogleOAuth__ClientId=$GOOGLE_CLIENT_ID"
  "GoogleOAuth__ClientSecret=$GOOGLE_CLIENT_SECRET"
  "GitHubOAuth__ClientId=$GITHUB_CLIENT_ID"
  "GitHubOAuth__ClientSecret=$GITHUB_CLIENT_SECRET"
  "EmailSettings__Provider=$EMAIL_PROVIDER"
  "EmailSettings__FromEmail=$EMAIL_FROM"
  "EmailSettings__SesRegion=$SES_REGION"
  "EmailSettings__SmtpHost=smtp.gmail.com"
  "EmailSettings__SmtpPort=587"
  "EmailSettings__SmtpUser=$SMTP_USER"
  "EmailSettings__SmtpPassword=$SMTP_PASSWORD"
  "Embeddings__Provider=${EMBEDDINGS_PROVIDER:-gemini}"
  "Embeddings__Model=${EMBEDDINGS_MODEL:-gemini-embedding-001}"
  "Embeddings__ApiKey=$EMBEDDINGS_API_KEY"
  # Where the API reads index.html from to render /share/{token}, and the origin the share URLs
  # in those previews are built from.
  "Web__PublicOrigin=$WEB_ORIGIN"
  "Cors__AllowedOrigins__0=$WEB_ORIGIN"
  "Cors__AllowedOrigins__1=$ADMIN_ORIGIN"
  "Cors__AllowedOrigins__2=$WEB_WWW_ORIGIN"
  # What the ECS task role used to provide. The SDK's default credential chain picks these up for
  # both the documents bucket and SES.
  "AWS_ACCESS_KEY_ID=$LIGHTSAIL_AWS_ACCESS_KEY_ID"
  "AWS_SECRET_ACCESS_KEY=$LIGHTSAIL_AWS_SECRET_ACCESS_KEY"
  "AWS_REGION=$AWS_REGION"
)

echo "==> Deploying the API container"
# The env file carries every secret the container needs, so it is written with a restrictive umask
# here, moved into place root-owned 0600, and never echoed. docker --env-file takes each line
# literally: no quoting, no expansion, and no value may contain a newline.
ENV_FILE="$(mktemp)"
trap 'rm -f "$ENV_FILE"' EXIT
(umask 077; printf '%s\n' "${API_ENVIRONMENT[@]}" > "$ENV_FILE")
if grep -qc $'\r' "$ENV_FILE"; then
  echo "An environment value contains a carriage return; docker --env-file would keep it." >&2
  exit 1
fi
scp -o StrictHostKeyChecking=accept-new -q -i "$LIGHTSAIL_SSH_KEY" "$ENV_FILE" \
  "$LIGHTSAIL_SSH_USER@$LIGHTSAIL_IP:/tmp/api.env.new"
"${SSH[@]}" "sudo install -o root -g root -m 600 /tmp/api.env.new $LIGHTSAIL_APP_DIR/api.env && rm -f /tmp/api.env.new"

# A 12-hour ECR token travels over the ssh pipe, so no AWS credential has to sit on the instance
# for the pull itself.
aws ecr get-login-password --region "$AWS_REGION" | \
  "${SSH[@]}" "sudo docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com" >/dev/null
"${SSH[@]}" "sudo docker pull $ECR_URI:$IMAGE_TAG" >/dev/null
echo "    Image on the instance: $IMAGE_TAG"

# One box means one container: the old one stops before the new one starts, so a deploy is a short
# outage (container start plus any pending migration) rather than a rolling replacement. The
# DataProtection volume is what keeps that restart from invalidating every issued antiforgery token.
"${SSH[@]}" "set -e
  sudo mkdir -p $LIGHTSAIL_APP_DIR/dp-keys
  sudo docker rm -f $API_CONTAINER_NAME >/dev/null 2>&1 || true
  sudo docker run -d --name $API_CONTAINER_NAME --restart unless-stopped \
    -p 80:$API_CONTAINER_PORT \
    --env-file $LIGHTSAIL_APP_DIR/api.env \
    -v $LIGHTSAIL_APP_DIR/dp-keys:/root/.aspnet/DataProtection-Keys \
    --log-driver=awslogs \
    --log-opt awslogs-region=$AWS_REGION \
    --log-opt awslogs-group=$LOG_GROUP_NAME \
    --log-opt awslogs-stream=lightsail/$API_CONTAINER_NAME \
    $ECR_URI:$IMAGE_TAG >/dev/null" 
echo "    Container started; waiting for /health"

API_HEALTHY=0
for _ in $(seq 1 30); do
  if "${SSH[@]}" "curl -sf -m 5 http://localhost/health >/dev/null"; then API_HEALTHY=1; break; fi
  sleep 5
done
if [[ "$API_HEALTHY" != "1" ]]; then
  echo "The API never reported healthy. Last container logs:" >&2
  "${SSH[@]}" "sudo docker logs --tail 40 $API_CONTAINER_NAME" >&2 || true
  exit 1
fi
echo "    API healthy on $LIGHTSAIL_IP"

# Images are ~1.2 GB each; without this the 60 GB disk fills after roughly forty deploys.
"${SSH[@]}" "sudo docker image prune -af --filter 'until=168h'" >/dev/null 2>&1 || true

if [[ "$DEPLOY_BACKEND_ONLY" == "1" ]]; then
  echo ""
  echo "Backend deployment complete"
  echo "  Image: $ECR_URI:$IMAGE_TAG"
  echo "  API:   $API_URL"
  exit 0
fi

deploy_frontends
summary "Deployment complete"
echo "  Docs:  s3://$DOCS_BUCKET"
