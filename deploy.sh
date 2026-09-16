#!/bin/bash
set -euo pipefail

# AWS deployment:
# - API: ECS Fargate behind an ALB, image from ECR, fronted by CloudFront.
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

ensure_role() {
  local name="$1"
  aws iam get-role --role-name "$name" >/dev/null 2>&1 || \
    aws iam create-role --role-name "$name" --assume-role-policy-document \
      '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  aws iam get-role --role-name "$name" --query Role.Arn --output text
}

ensure_security_group() {
  local name="$1" description="$2" id
  id="$(aws_opt ec2 describe-security-groups --filters Name=group-name,Values="$name" Name=vpc-id,Values="$VPC_ID" --query 'SecurityGroups[0].GroupId' --output text)"
  [[ -n "$id" ]] || id="$(aws ec2 create-security-group --group-name "$name" --description "$description" --vpc-id "$VPC_ID" --query GroupId --output text)"
  printf '%s' "$id"
}

# field is DomainName or Id.
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

# ensure_share_preview_behavior <alb dns name>. Points /share/* on the web distribution at the API
# instead of the S3 bucket, and is a no-op once that behavior exists.
#
# Why: /share/{token} is a client-rendered route, so a crawler served the S3 index.html sees the
# landing page's card and every shared link unfurls identically on Slack, X, LinkedIn and WeChat.
# The API renders the same shell with that share's title, summary snippet and contents already in
# the meta tags (SharePreviewController), so the app still boots exactly as before — the crawler
# just gets something to read. Everything outside /share/* keeps coming from S3.
ensure_share_preview_behavior() {
  local alb="$1" dist_id etag config updated config_file
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

  if jq -e --arg origin "$alb" '
      (.CacheBehaviors.Items // []) | any(.PathPattern == "/share/*" and .TargetOriginId == $origin)
    ' <<<"$config" >/dev/null; then
    echo "    /share/* already routed to the API"
    rm -f "$config_file"
    return 0
  fi

  # The API is reached at its load balancer rather than through its own CloudFront distribution:
  # one hop, and the same origin settings that distribution uses.
  updated="$(jq --arg origin "$alb" '
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
  local alb_dns_name="$1" website_suffix="s3-website-$AWS_REGION.amazonaws.com" admin api
  admin="${ADMIN_PUBLIC_ORIGIN:-$(domain_origin admin)}"
  api="${API_PUBLIC_ORIGIN:-$(domain_origin api)}"
  WEB_ORIGIN="${WEB_PUBLIC_ORIGIN:-$(ensure_cloudfront "$WEB_CLOUDFRONT_COMMENT" "$WEB_BUCKET.$website_suffix" static)}"
  ADMIN_ORIGIN="${admin:-$(ensure_cloudfront "$ADMIN_CLOUDFRONT_COMMENT" "$ADMIN_BUCKET.$website_suffix" static)}"
  API_URL="${api:-$(ensure_cloudfront "$API_CLOUDFRONT_COMMENT" "$alb_dns_name" api)}"
  if [[ -n "$PUBLIC_DOMAIN" && "$WEB_ORIGIN" == "https://$PUBLIC_DOMAIN" ]]; then
    WEB_WWW_ORIGIN="${WEB_WWW_PUBLIC_ORIGIN:-https://www.$PUBLIC_DOMAIN}"
  else
    WEB_WWW_ORIGIN="${WEB_WWW_PUBLIC_ORIGIN:-$WEB_ORIGIN}"
  fi
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
  aws s3 sync web/dist "s3://$WEB_BUCKET" --delete
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
  aws s3 sync admin/dist "s3://$ADMIN_BUCKET" --delete
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
  # The one database credential this script handles, and it never leaves the ECS task definition.
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

# No ElastiCache is provisioned; these only reach the task definition, for a Redis you run yourself.
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

# The image architecture and the task's runtime architecture must agree, and on a developer's
# Apple-silicon Mac they do not by default: `docker build` produces linux/arm64 while ECS defaults
# Fargate tasks to X86_64, so the task fails to start with "image manifest does not contain a
# descriptor matching platform". One variable sets both.
#
# X86_64 is the default because it matches ECS's own default and is the best-supported target for the
# native Whisper.net runtime in the image. ARM64 (Graviton) is cheaper and builds natively on an
# M-series Mac — switch only after confirming the image actually runs there.
ECS_CPU_ARCHITECTURE="$(printf '%s' "${ECS_CPU_ARCHITECTURE:-X86_64}" | tr '[:lower:]' '[:upper:]')"
case "$ECS_CPU_ARCHITECTURE" in
  X86_64) DOCKER_BUILD_PLATFORM="linux/amd64" ;;
  ARM64)  DOCKER_BUILD_PLATFORM="linux/arm64" ;;
  *) echo "ECS_CPU_ARCHITECTURE must be X86_64 (default) or ARM64; got '$ECS_CPU_ARCHITECTURE'" >&2; exit 1 ;;
esac

AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ECR_REPOSITORY="${ECR_REPOSITORY:-$APP_NAME-api}"
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY"
DOCS_BUCKET="${DOCS_BUCKET:-$(bucket_name documents)}"
WEB_BUCKET="${WEB_BUCKET:-$(bucket_name web)}"
ADMIN_BUCKET="${ADMIN_BUCKET:-$(bucket_name admin)}"
ECS_CLUSTER_NAME="${ECS_CLUSTER_NAME:-${APP_NAME}-cluster}"
ECS_SERVICE_NAME="${ECS_SERVICE_NAME:-${APP_NAME}-api}"
ECS_TASK_FAMILY="${ECS_TASK_FAMILY:-${APP_NAME}-api}"
ECS_EXECUTION_ROLE_NAME="${ECS_EXECUTION_ROLE_NAME:-${APP_NAME}-ecs-execution}"
ECS_TASK_ROLE_NAME="${ECS_TASK_ROLE_NAME:-${APP_NAME}-ecs-task}"
ECS_SECURITY_GROUP_NAME="${ECS_SECURITY_GROUP_NAME:-${APP_NAME}-ecs-api}"
ECS_DESIRED_COUNT="${ECS_DESIRED_COUNT:-1}"
# 100 with maximumPercent=200 means the replacement task has to pass its target-group health
# check before the old one is stopped. At 0 ECS stops the only task first, and with a single
# task that leaves the ALB with no healthy target — the API answers 503 for the whole rollout.
ECS_MIN_HEALTHY_PERCENT="${ECS_MIN_HEALTHY_PERCENT:-100}"
ECS_MAX_PERCENT="${ECS_MAX_PERCENT:-200}"
ECS_CPU="${ECS_CPU:-1024}"
# Fargate only accepts specific cpu/memory pairs — 1024 CPU units means 2–8 GB.
ECS_MEMORY="${ECS_MEMORY:-2048}"
API_CONTAINER_NAME="${API_CONTAINER_NAME:-api}"
API_CONTAINER_PORT="${API_CONTAINER_PORT:-5000}"
ALB_NAME="${ALB_NAME:-${APP_NAME}-api}"
ALB_SECURITY_GROUP_NAME="${ALB_SECURITY_GROUP_NAME:-${APP_NAME}-alb}"
# Fargate tasks register with the target group by IP.
ALB_TARGET_GROUP_NAME="${ALB_TARGET_GROUP_NAME:-${APP_NAME}-api-fg-tg}"
LOG_GROUP_NAME="${LOG_GROUP_NAME:-/ecs/${APP_NAME}-api}"
WEB_CLOUDFRONT_COMMENT="${WEB_CLOUDFRONT_COMMENT:-${APP_NAME}-web-cloudfront}"
ADMIN_CLOUDFRONT_COMMENT="${ADMIN_CLOUDFRONT_COMMENT:-${APP_NAME}-admin-cloudfront}"
API_CLOUDFRONT_COMMENT="${API_CLOUDFRONT_COMMENT:-${APP_NAME}-api-cloudfront}"
IMAGE_TAG="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)-$(date +%Y%m%d%H%M%S)"

# ------------------------------------------------------------------- web -----

if [[ "$DEPLOY_WEB_ONLY" == "1" ]]; then
  ALB_DNS_NAME="$(aws_opt elbv2 describe-load-balancers --names "$ALB_NAME" --query 'LoadBalancers[0].DNSName' --output text)"
  if [[ -z "$ALB_DNS_NAME" ]]; then
    echo "ECS load balancer $ALB_NAME was not found. Run ./deploy.sh first." >&2
    exit 1
  fi
  echo "==> Resolving public origins"
  resolve_public_origins "$ALB_DNS_NAME"
  ensure_share_preview_behavior "$ALB_DNS_NAME"
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

echo "==> Creating ECS IAM roles"
EXECUTION_ROLE_ARN="$(ensure_role "$ECS_EXECUTION_ROLE_NAME")"
aws iam attach-role-policy --role-name "$ECS_EXECUTION_ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy >/dev/null
TASK_ROLE_ARN="$(ensure_role "$ECS_TASK_ROLE_NAME")"
aws iam put-role-policy --role-name "$ECS_TASK_ROLE_NAME" --policy-name "${APP_NAME}-documents-s3" \
  --policy-document "$(jq -nc --arg bucket "arn:aws:s3:::$DOCS_BUCKET" '{
    Version: "2012-10-17",
    Statement: [
      {Effect: "Allow", Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource: ($bucket + "/*")},
      {Effect: "Allow", Action: ["s3:ListBucket", "s3:GetBucketLocation"], Resource: $bucket}
    ]}')" >/dev/null
aws iam put-role-policy --role-name "$ECS_TASK_ROLE_NAME" --policy-name "${APP_NAME}-ses-email" \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["ses:SendEmail"],"Resource":"*"}]}' >/dev/null

echo "==> Resolving network"
VPC_ID="$(aws_opt ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)"
if [[ -z "$VPC_ID" ]]; then
  echo "    No default VPC found in $AWS_REGION; creating one"
  VPC_ID="$(aws ec2 create-default-vpc --query Vpc.VpcId --output text)"
fi
read -r -a SUBNET_IDS <<< "$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC_ID" --query 'Subnets[].SubnetId' --output text)"
if [[ "${#SUBNET_IDS[@]}" -eq 0 ]]; then
  echo "No subnets found in default VPC $VPC_ID" >&2
  exit 1
fi

# The database is reached outbound over TLS, so there is no inbound database port to open here.
ALB_SECURITY_GROUP_ID="$(ensure_security_group "$ALB_SECURITY_GROUP_NAME" "${APP_NAME} public API load balancer")"
aws ec2 authorize-security-group-ingress --group-id "$ALB_SECURITY_GROUP_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0 >/dev/null 2>&1 || true
ECS_SECURITY_GROUP_ID="$(ensure_security_group "$ECS_SECURITY_GROUP_NAME" "${APP_NAME} ECS API tasks")"
aws ec2 authorize-security-group-ingress --group-id "$ECS_SECURITY_GROUP_ID" --protocol tcp --port "$API_CONTAINER_PORT" --source-group "$ALB_SECURITY_GROUP_ID" >/dev/null 2>&1 || true

# Nothing to provision for the database: it lives in Supabase and is reached over TLS. The connection
# string is passed straight through to the task definition — never into the image, a file in the
# repo, or any frontend build.
echo "==> Using external managed PostgreSQL (Supabase)"
echo "    Database host: $(printf '%s' "$DATABASE_CONNECTION_STRING" | tr ';' '\n' | awk -F= 'tolower($1) ~ /^ *host *$/ {print $2}' | head -1)"
if printf '%s' "$DATABASE_CONNECTION_STRING" | grep -qiE '(^|;) *ssl *mode *= *disable'; then
  echo "DATABASE_CONNECTION_STRING disables TLS (SSL Mode=Disable). Supabase requires an encrypted connection." >&2
  exit 1
fi

# ------------------------------------------------------------- alb + ecs -----

echo "==> Deploying API to ECS (Fargate)"
aws logs create-log-group --log-group-name "$LOG_GROUP_NAME" >/dev/null 2>&1 || true
[[ "$(aws_opt ecs describe-clusters --clusters "$ECS_CLUSTER_NAME" --query 'clusters[0].status' --output text)" == "ACTIVE" ]] || \
  aws ecs create-cluster --cluster-name "$ECS_CLUSTER_NAME" >/dev/null
echo "    ECS cluster ready: $ECS_CLUSTER_NAME"

ALB_ARN="$(aws_opt elbv2 describe-load-balancers --names "$ALB_NAME" --query 'LoadBalancers[0].LoadBalancerArn' --output text)"
if [[ -z "$ALB_ARN" ]]; then
  ALB_ARN="$(aws elbv2 create-load-balancer --name "$ALB_NAME" --subnets "${SUBNET_IDS[@]}" \
    --security-groups "$ALB_SECURITY_GROUP_ID" --scheme internet-facing --type application \
    --query 'LoadBalancers[0].LoadBalancerArn' --output text)"
fi
aws elbv2 wait load-balancer-available --load-balancer-arns "$ALB_ARN"
ALB_DNS_NAME="$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" --query 'LoadBalancers[0].DNSName' --output text)"
echo "    Load balancer ready: $ALB_DNS_NAME"

TARGET_GROUP_ARN="$(aws_opt elbv2 describe-target-groups --names "$ALB_TARGET_GROUP_NAME" --query 'TargetGroups[0].TargetGroupArn' --output text)"
if [[ -z "$TARGET_GROUP_ARN" ]]; then
  TARGET_GROUP_ARN="$(aws elbv2 create-target-group --name "$ALB_TARGET_GROUP_NAME" --protocol HTTP \
    --port "$API_CONTAINER_PORT" --vpc-id "$VPC_ID" --target-type ip \
    --health-check-protocol HTTP --health-check-path /health --matcher HttpCode=200-399 \
    --query 'TargetGroups[0].TargetGroupArn' --output text)"
fi

LISTENER_ARN="$(aws_opt elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --query 'Listeners[?Port==`80`].ListenerArn | [0]' --output text)"
if [[ -z "$LISTENER_ARN" ]]; then
  aws elbv2 create-listener --load-balancer-arn "$ALB_ARN" --protocol HTTP --port 80 \
    --default-actions Type=forward,TargetGroupArn="$TARGET_GROUP_ARN" >/dev/null
else
  aws elbv2 modify-listener --listener-arn "$LISTENER_ARN" \
    --default-actions Type=forward,TargetGroupArn="$TARGET_GROUP_ARN" >/dev/null
fi
echo "    Target group and HTTP listener ready"

echo "==> Resolving public origins"
resolve_public_origins "$ALB_DNS_NAME"
ensure_share_preview_behavior "$ALB_DNS_NAME"
echo "    Web:   $WEB_ORIGIN"
echo "    Admin: $ADMIN_ORIGIN"
echo "    API:   $API_URL"

TASK_ENVIRONMENT=(
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
)

TASK_DEFINITION="$(jq -n \
  --arg family "$ECS_TASK_FAMILY" \
  --arg executionRoleArn "$EXECUTION_ROLE_ARN" \
  --arg taskRoleArn "$TASK_ROLE_ARN" \
  --arg cpu "$ECS_CPU" \
  --arg memory "$ECS_MEMORY" \
  --arg cpuArchitecture "$ECS_CPU_ARCHITECTURE" \
  --arg containerName "$API_CONTAINER_NAME" \
  --argjson containerPort "$API_CONTAINER_PORT" \
  --arg image "$ECR_URI:$IMAGE_TAG" \
  --arg awsRegion "$AWS_REGION" \
  --arg logGroup "$LOG_GROUP_NAME" \
  --args '{
    family: $family,
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    runtimePlatform: {cpuArchitecture: $cpuArchitecture, operatingSystemFamily: "LINUX"},
    cpu: $cpu,
    memory: $memory,
    executionRoleArn: $executionRoleArn,
    taskRoleArn: $taskRoleArn,
    containerDefinitions: [{
      name: $containerName,
      image: $image,
      essential: true,
      portMappings: [{containerPort: $containerPort, protocol: "tcp"}],
      environment: [$ARGS.positional[] | index("=") as $i | {name: .[:$i], value: .[$i + 1:]}],
      logConfiguration: {
        logDriver: "awslogs",
        options: {
          "awslogs-group": $logGroup,
          "awslogs-region": $awsRegion,
          "awslogs-stream-prefix": $containerName
        }
      }
    }]
  }' "${TASK_ENVIRONMENT[@]}")"
TASK_DEFINITION_ARN="$(aws ecs register-task-definition --cli-input-json "$TASK_DEFINITION" --query 'taskDefinition.taskDefinitionArn' --output text)"
echo "    Task definition registered: $TASK_DEFINITION_ARN"

SERVICE_STATUS="$(aws_opt ecs describe-services --cluster "$ECS_CLUSTER_NAME" --services "$ECS_SERVICE_NAME" --query 'services[0].status' --output text)"
# awsvpc gives each Fargate task its own ENI. A public IP is what lets it pull from ECR and reach
# Supabase without a NAT gateway; the security group still allows inbound only from the ALB.
NETWORK_CONFIGURATION=(--network-configuration "awsvpcConfiguration={subnets=[$(IFS=,; echo "${SUBNET_IDS[*]}")],securityGroups=[$ECS_SECURITY_GROUP_ID],assignPublicIp=ENABLED}")
DEPLOYMENT_CONFIGURATION=(--deployment-configuration "minimumHealthyPercent=$ECS_MIN_HEALTHY_PERCENT,maximumPercent=$ECS_MAX_PERCENT")

if [[ "$SERVICE_STATUS" == "ACTIVE" || "$SERVICE_STATUS" == "DRAINING" ]]; then
  aws ecs update-service \
    --cluster "$ECS_CLUSTER_NAME" \
    --service "$ECS_SERVICE_NAME" \
    --task-definition "$TASK_DEFINITION_ARN" \
    --desired-count "$ECS_DESIRED_COUNT" \
    "${NETWORK_CONFIGURATION[@]}" \
    "${DEPLOYMENT_CONFIGURATION[@]}" \
    --force-new-deployment >/dev/null
else
  aws ecs create-service \
    --cluster "$ECS_CLUSTER_NAME" \
    --service-name "$ECS_SERVICE_NAME" \
    --task-definition "$TASK_DEFINITION_ARN" \
    --desired-count "$ECS_DESIRED_COUNT" \
    --launch-type FARGATE \
    "${NETWORK_CONFIGURATION[@]}" \
    "${DEPLOYMENT_CONFIGURATION[@]}" \
    --load-balancers "targetGroupArn=$TARGET_GROUP_ARN,containerName=$API_CONTAINER_NAME,containerPort=$API_CONTAINER_PORT" \
    --health-check-grace-period-seconds 120 >/dev/null
fi
echo "    ECS service deploying: $ECS_SERVICE_NAME"
aws ecs wait services-stable --cluster "$ECS_CLUSTER_NAME" --services "$ECS_SERVICE_NAME"

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
