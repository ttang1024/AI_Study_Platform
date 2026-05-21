#!/bin/bash
set -euo pipefail

# Low-cost AWS deployment:
# - API: ECS on EC2 backed by ECR and an Application Load Balancer.
# - Web/Admin: S3 static websites.
# - Documents: private S3 bucket.
# - Database: public RDS PostgreSQL in the default VPC.
# - Cache: ElastiCache Redis in the default VPC.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.env_variables" ]]; then
  # shellcheck source=.env_variables
  source "$SCRIPT_DIR/.env_variables"
fi

APP_NAME="${APP_NAME:-study-platform}"
AWS_REGION="${AWS_REGION:-ap-southeast-2}"
export AWS_DEFAULT_REGION="$AWS_REGION"
DB_USER="${DB_USER:-studyplatform}"
DB_NAME="${DB_NAME:-studyplatform}"
DB_INSTANCE_ID="${DB_INSTANCE_ID:-${APP_NAME}-db}"
DB_INSTANCE_CLASS="${DB_INSTANCE_CLASS:-db.t4g.micro}"
DB_ALLOCATED_STORAGE="${DB_ALLOCATED_STORAGE:-20}"
REDIS_CLUSTER_ID="${REDIS_CLUSTER_ID:-${APP_NAME}-redis}"
REDIS_NODE_TYPE="${REDIS_NODE_TYPE:-cache.t4g.micro}"
REDIS_PORT="${REDIS_PORT:-6379}"

GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:?Set GOOGLE_CLIENT_ID env var}"
GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID:?Set GITHUB_CLIENT_ID env var}"
if [[ "${DEPLOY_WEB_ONLY:-0}" != "1" ]]; then
  DB_PASS="${DB_PASS:?Set DB_PASS env var}"
  JWT_SECRET="${JWT_SECRET:?Set JWT_SECRET env var}"
  GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:?Set GOOGLE_CLIENT_SECRET env var}"
  GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET:?Set GITHUB_CLIENT_SECRET env var}"
  SMTP_USER="${SMTP_USER:?Set SMTP_USER env var}"
  SMTP_PASSWORD="${SMTP_PASSWORD:?Set SMTP_PASSWORD env var}"
fi

strip_cr() {
  printf '%s' "$1" | tr -d '\r'
}

bucket_name() {
  printf '%s-%s-%s-%s' "$APP_NAME" "$1" "$AWS_REGION" "$AWS_ACCOUNT_ID" | tr '[:upper:]' '[:lower:]' | tr '_' '-'
}

ensure_bucket() {
  local bucket="$1"
  if aws s3api head-bucket --bucket "$bucket" >/dev/null 2>&1; then
    echo "Bucket $bucket already exists, skipping"
    return
  fi

  local attempt
  for attempt in {1..30}; do
    if [[ "$AWS_REGION" == "us-east-1" ]]; then
      aws s3api create-bucket --bucket "$bucket" >/dev/null 2>&1 && return
    else
      aws s3api create-bucket \
        --bucket "$bucket" \
        --create-bucket-configuration "LocationConstraint=$AWS_REGION" >/dev/null 2>&1 && return
    fi

    if aws s3api head-bucket --bucket "$bucket" >/dev/null 2>&1; then
      echo "Bucket $bucket already exists, skipping"
      return
    fi
    echo "Bucket $bucket is not ready yet, retrying ($attempt/30)"
    sleep 10
  done

  echo "Failed to create bucket $bucket after retries" >&2
  return 1
}

put_public_website_policy() {
  local bucket="$1"
  aws s3api put-public-access-block \
    --bucket "$bucket" \
    --public-access-block-configuration BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false >/dev/null

  local policy_file
  policy_file="$(mktemp)"
  cat > "$policy_file" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadStaticWebsite",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$bucket/*"
    }
  ]
}
JSON
  aws s3api put-bucket-policy --bucket "$bucket" --policy "file://$policy_file" >/dev/null
  rm -f "$policy_file"
}

cloudfront_domain_by_comment() {
  local comment="$1"
  aws cloudfront list-distributions \
    --query "DistributionList.Items[?Comment=='$comment'].DomainName | [0]" \
    --output text 2>/dev/null || true
}

cloudfront_id_by_comment() {
  local comment="$1"
  aws cloudfront list-distributions \
    --query "DistributionList.Items[?Comment=='$comment'].Id | [0]" \
    --output text 2>/dev/null || true
}

ensure_static_cloudfront_distribution() {
  local comment="$1"
  local bucket="$2"
  local origin_domain="${bucket}.s3-website-${AWS_REGION}.amazonaws.com"
  local domain
  domain="$(cloudfront_domain_by_comment "$comment")"
  if [[ -n "$domain" && "$domain" != "None" ]]; then
    printf 'https://%s\n' "$domain"
    return
  fi

  local config
  config="$(mktemp)"
  jq -n \
    --arg callerReference "${comment}-$(date +%s)" \
    --arg comment "$comment" \
    --arg originId "$origin_domain" \
    --arg originDomain "$origin_domain" \
    '{
      CallerReference: $callerReference,
      Comment: $comment,
      Enabled: true,
      PriceClass: "PriceClass_100",
      DefaultRootObject: "index.html",
      Origins: {
        Quantity: 1,
        Items: [{
          Id: $originId,
          DomainName: $originDomain,
          CustomOriginConfig: {
            HTTPPort: 80,
            HTTPSPort: 443,
            OriginProtocolPolicy: "http-only",
            OriginReadTimeout: 300,
            OriginKeepaliveTimeout: 300,
            OriginSslProtocols: {Quantity: 1, Items: ["TLSv1.2"]}
          }
        }]
      },
      DefaultCacheBehavior: {
        TargetOriginId: $originId,
        ViewerProtocolPolicy: "redirect-to-https",
        Compress: true,
        TrustedSigners: {Enabled: false, Quantity: 0},
        AllowedMethods: {
          Quantity: 3,
          Items: ["GET", "HEAD", "OPTIONS"],
          CachedMethods: {Quantity: 2, Items: ["GET", "HEAD"]}
        },
        ForwardedValues: {
          QueryString: false,
          Cookies: {Forward: "none"}
        },
        MinTTL: 0,
        DefaultTTL: 300,
        MaxTTL: 86400
      },
      CustomErrorResponses: {
        Quantity: 2,
        Items: [
          {ErrorCode: 403, ResponsePagePath: "/index.html", ResponseCode: "200", ErrorCachingMinTTL: 0},
          {ErrorCode: 404, ResponsePagePath: "/index.html", ResponseCode: "200", ErrorCachingMinTTL: 0}
        ]
      },
      Restrictions: {GeoRestriction: {RestrictionType: "none", Quantity: 0}},
      ViewerCertificate: {CloudFrontDefaultCertificate: true}
    }' > "$config"
  domain="$(aws cloudfront create-distribution --distribution-config "file://$config" --query 'Distribution.DomainName' --output text)"
  rm -f "$config"
  printf 'https://%s\n' "$domain"
}

ensure_api_cloudfront_distribution() {
  local comment="$1"
  local alb_domain="$2"
  local domain
  domain="$(cloudfront_domain_by_comment "$comment")"
  if [[ -n "$domain" && "$domain" != "None" ]]; then
    printf 'https://%s\n' "$domain"
    return
  fi

  local config
  config="$(mktemp)"
  jq -n \
    --arg callerReference "${comment}-$(date +%s)" \
    --arg comment "$comment" \
    --arg originId "$alb_domain" \
    --arg originDomain "$alb_domain" \
    '{
      CallerReference: $callerReference,
      Comment: $comment,
      Enabled: true,
      PriceClass: "PriceClass_100",
      Origins: {
        Quantity: 1,
        Items: [{
          Id: $originId,
          DomainName: $originDomain,
          CustomOriginConfig: {
            HTTPPort: 80,
            HTTPSPort: 443,
            OriginProtocolPolicy: "http-only",
            OriginReadTimeout: 300,
            OriginKeepaliveTimeout: 300,
            OriginSslProtocols: {Quantity: 1, Items: ["TLSv1.2"]}
          }
        }]
      },
      DefaultCacheBehavior: {
        TargetOriginId: $originId,
        ViewerProtocolPolicy: "redirect-to-https",
        Compress: true,
        TrustedSigners: {Enabled: false, Quantity: 0},
        AllowedMethods: {
          Quantity: 7,
          Items: ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
          CachedMethods: {Quantity: 2, Items: ["GET", "HEAD"]}
        },
        ForwardedValues: {
          QueryString: true,
          Cookies: {Forward: "all"},
          Headers: {Quantity: 1, Items: ["*"]}
        },
        MinTTL: 0,
        DefaultTTL: 0,
        MaxTTL: 0
      },
      Restrictions: {GeoRestriction: {RestrictionType: "none", Quantity: 0}},
      ViewerCertificate: {CloudFrontDefaultCertificate: true}
    }' > "$config"
  domain="$(aws cloudfront create-distribution --distribution-config "file://$config" --query 'Distribution.DomainName' --output text)"
  rm -f "$config"
  printf 'https://%s\n' "$domain"
}

invalidate_cloudfront_by_comment() {
  local comment="$1"
  local distribution_id
  distribution_id="$(cloudfront_id_by_comment "$comment")"
  if [[ -n "$distribution_id" && "$distribution_id" != "None" ]]; then
    aws cloudfront create-invalidation --distribution-id "$distribution_id" --paths '/*' >/dev/null
  fi
}

GOOGLE_CLIENT_ID="$(strip_cr "$GOOGLE_CLIENT_ID")"
GITHUB_CLIENT_ID="$(strip_cr "$GITHUB_CLIENT_ID")"
DB_PASS="$(strip_cr "${DB_PASS:-}")"
JWT_SECRET="$(strip_cr "${JWT_SECRET:-}")"
GOOGLE_CLIENT_SECRET="$(strip_cr "${GOOGLE_CLIENT_SECRET:-}")"
GITHUB_CLIENT_SECRET="$(strip_cr "${GITHUB_CLIENT_SECRET:-}")"
SMTP_USER="$(strip_cr "${SMTP_USER:-}")"
SMTP_PASSWORD="$(strip_cr "${SMTP_PASSWORD:-}")"
EMAIL_PROVIDER="$(strip_cr "${EMAIL_PROVIDER:-Smtp}")"
EMAIL_FROM="${EMAIL_FROM:-$SMTP_USER}"
EMAIL_FROM="$(strip_cr "$EMAIL_FROM")"
SES_REGION="$(strip_cr "${SES_REGION:-$AWS_REGION}")"
YOUTUBE_PROXY_URL="$(strip_cr "${YOUTUBE_PROXY_URL:-${YouTube__ProxyUrl:-}}")"
YOUTUBE_COOKIES_B64="$(strip_cr "${YOUTUBE_COOKIES_B64:-${YouTube__CookiesBase64:-}}")"
REDIS_ENABLED="$(strip_cr "${REDIS_ENABLED:-false}")"
REDIS_CONNECTION_STRING="$(strip_cr "${REDIS_CONNECTION_STRING:-}")"
REDIS_INSTANCE_NAME="$(strip_cr "${REDIS_INSTANCE_NAME:-StudyPlatform:}")"

AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ECR_REPOSITORY="${ECR_REPOSITORY:-$APP_NAME-api}"
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY"
DOCS_BUCKET="${DOCS_BUCKET:-$(bucket_name documents)}"
WEB_BUCKET="${WEB_BUCKET:-$(bucket_name web)}"
ADMIN_BUCKET="${ADMIN_BUCKET:-$(bucket_name admin)}"
BUILD_BUCKET="${BUILD_BUCKET:-$(bucket_name build)}"
API_SERVICE_NAME="${API_SERVICE_NAME:-$APP_NAME-api}"
ECS_CLUSTER_NAME="${ECS_CLUSTER_NAME:-${APP_NAME}-cluster}"
ECS_SERVICE_NAME="${ECS_SERVICE_NAME:-$API_SERVICE_NAME}"
ECS_TASK_FAMILY="${ECS_TASK_FAMILY:-$API_SERVICE_NAME}"
ECS_EXECUTION_ROLE_NAME="${ECS_EXECUTION_ROLE_NAME:-${APP_NAME}-ecs-execution}"
ECS_TASK_ROLE_NAME="${ECS_TASK_ROLE_NAME:-${APP_NAME}-ecs-task}"
ECS_INSTANCE_ROLE_NAME="${ECS_INSTANCE_ROLE_NAME:-${APP_NAME}-ecs-instance}"
ECS_INSTANCE_PROFILE_NAME="${ECS_INSTANCE_PROFILE_NAME:-$ECS_INSTANCE_ROLE_NAME}"
ECS_SECURITY_GROUP_NAME="${ECS_SECURITY_GROUP_NAME:-${APP_NAME}-ecs-api}"
ECS_DESIRED_COUNT="${ECS_DESIRED_COUNT:-1}"
ECS_CPU="${ECS_CPU:-1024}"
ECS_MEMORY="${ECS_MEMORY:-768}"
ECS_EC2_INSTANCE_NAME="${ECS_EC2_INSTANCE_NAME:-${APP_NAME}-ecs-api}"
ECS_EC2_INSTANCE_TYPE="${ECS_EC2_INSTANCE_TYPE:-t3.micro}"
ECS_EC2_AMI_ID="${ECS_EC2_AMI_ID:-}"
API_CONTAINER_NAME="${API_CONTAINER_NAME:-api}"
API_CONTAINER_PORT="${API_CONTAINER_PORT:-5000}"
ALB_NAME="${ALB_NAME:-${APP_NAME}-api}"
ALB_SECURITY_GROUP_NAME="${ALB_SECURITY_GROUP_NAME:-${APP_NAME}-alb}"
ALB_TARGET_GROUP_NAME="${ALB_TARGET_GROUP_NAME:-${APP_NAME}-api-ec2-tg}"
LOG_GROUP_NAME="${LOG_GROUP_NAME:-/ecs/${APP_NAME}-api}"
REDIS_SECURITY_GROUP_NAME="${REDIS_SECURITY_GROUP_NAME:-${APP_NAME}-redis}"
REDIS_SUBNET_GROUP_NAME="${REDIS_SUBNET_GROUP_NAME:-${APP_NAME}-redis-subnets}"
CODEBUILD_ROLE_NAME="${CODEBUILD_ROLE_NAME:-${APP_NAME}-codebuild}"
CODEBUILD_PROJECT_NAME="${CODEBUILD_PROJECT_NAME:-${APP_NAME}-api-image}"
WEB_CLOUDFRONT_COMMENT="${WEB_CLOUDFRONT_COMMENT:-${APP_NAME}-web-cloudfront}"
ADMIN_CLOUDFRONT_COMMENT="${ADMIN_CLOUDFRONT_COMMENT:-${APP_NAME}-admin-cloudfront}"
API_CLOUDFRONT_COMMENT="${API_CLOUDFRONT_COMMENT:-${APP_NAME}-api-cloudfront}"

COMMIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
IMAGE_TAG="${COMMIT_SHA}-$(date +%Y%m%d%H%M%S)"

if [[ "${DEPLOY_WEB_ONLY:-0}" == "1" ]]; then
  ALB_DNS_NAME="$(aws elbv2 describe-load-balancers --names "$ALB_NAME" --query 'LoadBalancers[0].DNSName' --output text 2>/dev/null || true)"
  if [[ -z "$ALB_DNS_NAME" || "$ALB_DNS_NAME" == "None" ]]; then
    echo "ECS load balancer $ALB_NAME was not found. Run ./deploy.sh first." >&2
    exit 1
  fi
  echo "==> Creating CloudFront distributions"
  WEB_ORIGIN="${WEB_PUBLIC_ORIGIN:-$(ensure_static_cloudfront_distribution "$WEB_CLOUDFRONT_COMMENT" "$WEB_BUCKET")}"
  ADMIN_ORIGIN="${ADMIN_PUBLIC_ORIGIN:-$(ensure_static_cloudfront_distribution "$ADMIN_CLOUDFRONT_COMMENT" "$ADMIN_BUCKET")}"
  API_URL="${API_PUBLIC_ORIGIN:-$(ensure_api_cloudfront_distribution "$API_CLOUDFRONT_COMMENT" "$ALB_DNS_NAME")}"

  echo "==> Building web frontend"
  (
    cd web
    npm ci
    VITE_API_URL="$API_URL" \
    VITE_SHARE_BASE_URL="$WEB_ORIGIN" \
    VITE_GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
    VITE_GITHUB_CLIENT_ID="$GITHUB_CLIENT_ID" \
    npm run build
  )
  aws s3 sync web/dist "s3://$WEB_BUCKET" --delete
  invalidate_cloudfront_by_comment "$WEB_CLOUDFRONT_COMMENT"

  echo "==> Building admin frontend"
  (
    cd admin
    npm ci
    VITE_API_URL="$API_URL" npm run build
  )
  aws s3 sync admin/dist "s3://$ADMIN_BUCKET" --delete
  invalidate_cloudfront_by_comment "$ADMIN_CLOUDFRONT_COMMENT"

  echo ""
  echo "Frontend deployment complete"
  echo "  Web:   $WEB_ORIGIN"
  echo "  Admin: $ADMIN_ORIGIN"
  echo "  API:   $API_URL"
  exit 0
fi

echo "==> Creating S3 buckets"
ensure_bucket "$DOCS_BUCKET"
ensure_bucket "$WEB_BUCKET"
ensure_bucket "$ADMIN_BUCKET"
ensure_bucket "$BUILD_BUCKET"
aws s3api put-bucket-encryption \
  --bucket "$DOCS_BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' >/dev/null
aws s3 website "s3://$WEB_BUCKET" --index-document index.html --error-document index.html >/dev/null
aws s3 website "s3://$ADMIN_BUCKET" --index-document index.html --error-document index.html >/dev/null
put_public_website_policy "$WEB_BUCKET"
put_public_website_policy "$ADMIN_BUCKET"

echo "==> Creating ECR repository"
aws ecr describe-repositories --repository-names "$ECR_REPOSITORY" >/dev/null 2>&1 || \
  aws ecr create-repository --repository-name "$ECR_REPOSITORY" >/dev/null

echo "==> Building and pushing API image"
if docker info >/dev/null 2>&1; then
  aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
  docker build -t "$ECR_URI:$IMAGE_TAG" -t "$ECR_URI:latest" ./server
  docker push "$ECR_URI:$IMAGE_TAG"
  docker push "$ECR_URI:latest"
else
  echo "Local Docker is unavailable; building API image with AWS CodeBuild"
  CODEBUILD_TRUST="$(mktemp)"
  CODEBUILD_POLICY="$(mktemp)"
  cat > "$CODEBUILD_TRUST" <<JSON
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"codebuild.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
  cat > "$CODEBUILD_POLICY" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect":"Allow","Action":["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"],"Resource":"*"},
    {"Effect":"Allow","Action":["ecr:GetAuthorizationToken"],"Resource":"*"},
    {"Effect":"Allow","Action":["ecr:BatchCheckLayerAvailability","ecr:CompleteLayerUpload","ecr:InitiateLayerUpload","ecr:PutImage","ecr:UploadLayerPart"],"Resource":"arn:aws:ecr:$AWS_REGION:$AWS_ACCOUNT_ID:repository/$ECR_REPOSITORY"},
    {"Effect":"Allow","Action":["s3:GetObject","s3:GetObjectVersion","s3:PutObject"],"Resource":"arn:aws:s3:::$BUILD_BUCKET/*"}
  ]
}
JSON
  aws iam get-role --role-name "$CODEBUILD_ROLE_NAME" >/dev/null 2>&1 || \
    aws iam create-role --role-name "$CODEBUILD_ROLE_NAME" --assume-role-policy-document "file://$CODEBUILD_TRUST" >/dev/null
  aws iam put-role-policy --role-name "$CODEBUILD_ROLE_NAME" --policy-name "${APP_NAME}-codebuild-deploy" --policy-document "file://$CODEBUILD_POLICY" >/dev/null
  CODEBUILD_ROLE_ARN="$(aws iam get-role --role-name "$CODEBUILD_ROLE_NAME" --query Role.Arn --output text)"
  rm -f "$CODEBUILD_TRUST" "$CODEBUILD_POLICY"

  BUILDSPEC="/tmp/buildspec.yml"
  cat > "$BUILDSPEC" <<YAML
version: 0.2
phases:
  pre_build:
    commands:
      - aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
  build:
    commands:
      - docker build -t $ECR_URI:$IMAGE_TAG -t $ECR_URI:latest ./server
  post_build:
    commands:
      - docker push $ECR_URI:$IMAGE_TAG
      - docker push $ECR_URI:latest
YAML

  BUILD_SOURCE="/tmp/${APP_NAME}-source-${IMAGE_TAG}.zip"
  rm -f "$BUILD_SOURCE"
  zip -qr "$BUILD_SOURCE" . \
    -x ".git/*" \
    -x ".env_variables" \
    -x "cookies*.txt" \
    -x "Webshare_residential_proxies.txt" \
    -x "web/node_modules/*" \
    -x "admin/node_modules/*" \
    -x "server/**/bin/*" \
    -x "server/**/obj/*" \
    -x "web/dist/*" \
    -x "admin/dist/*" \
    -x "__blobstorage__/*"
  zip -qj "$BUILD_SOURCE" "$BUILDSPEC"
  aws s3 cp "$BUILD_SOURCE" "s3://$BUILD_BUCKET/source/$IMAGE_TAG.zip" >/dev/null
  rm -f "$BUILD_SOURCE" "$BUILDSPEC"

  if aws codebuild batch-get-projects --names "$CODEBUILD_PROJECT_NAME" --query 'projects[0].name' --output text | grep -q "$CODEBUILD_PROJECT_NAME"; then
    aws codebuild update-project \
      --name "$CODEBUILD_PROJECT_NAME" \
      --source "type=S3,location=$BUILD_BUCKET/source/$IMAGE_TAG.zip" \
      --artifacts type=NO_ARTIFACTS \
      --environment type=LINUX_CONTAINER,image=aws/codebuild/standard:7.0,computeType=BUILD_GENERAL1_SMALL,privilegedMode=true \
      --service-role "$CODEBUILD_ROLE_ARN" >/dev/null
  else
    aws codebuild create-project \
      --name "$CODEBUILD_PROJECT_NAME" \
      --source "type=S3,location=$BUILD_BUCKET/source/$IMAGE_TAG.zip" \
      --artifacts type=NO_ARTIFACTS \
      --environment type=LINUX_CONTAINER,image=aws/codebuild/standard:7.0,computeType=BUILD_GENERAL1_SMALL,privilegedMode=true \
      --service-role "$CODEBUILD_ROLE_ARN" >/dev/null
  fi

  BUILD_ID="$(aws codebuild start-build --project-name "$CODEBUILD_PROJECT_NAME" --query build.id --output text)"
  while true; do
    BUILD_STATUS="$(aws codebuild batch-get-builds --ids "$BUILD_ID" --query 'builds[0].buildStatus' --output text)"
    case "$BUILD_STATUS" in
      SUCCEEDED) break ;;
      FAILED|FAULT|STOPPED|TIMED_OUT)
        echo "CodeBuild image build failed with status $BUILD_STATUS" >&2
        exit 1
        ;;
      *) sleep 15 ;;
    esac
  done
fi

echo "==> Creating ECS IAM roles"
ECS_TASK_TRUST="$(mktemp)"
cat > "$ECS_TASK_TRUST" <<JSON
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
ECS_INSTANCE_TRUST="$(mktemp)"
cat > "$ECS_INSTANCE_TRUST" <<JSON
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
aws iam get-role --role-name "$ECS_EXECUTION_ROLE_NAME" >/dev/null 2>&1 || \
  aws iam create-role --role-name "$ECS_EXECUTION_ROLE_NAME" --assume-role-policy-document "file://$ECS_TASK_TRUST" >/dev/null
aws iam attach-role-policy \
  --role-name "$ECS_EXECUTION_ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy >/dev/null

aws iam get-role --role-name "$ECS_TASK_ROLE_NAME" >/dev/null 2>&1 || \
  aws iam create-role --role-name "$ECS_TASK_ROLE_NAME" --assume-role-policy-document "file://$ECS_TASK_TRUST" >/dev/null
S3_POLICY="$(mktemp)"
cat > "$S3_POLICY" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::$DOCS_BUCKET/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::$DOCS_BUCKET"
    }
  ]
}
JSON
aws iam put-role-policy --role-name "$ECS_TASK_ROLE_NAME" --policy-name "${APP_NAME}-documents-s3" --policy-document "file://$S3_POLICY" >/dev/null
SES_POLICY="$(mktemp)"
cat > "$SES_POLICY" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail"],
      "Resource": "*"
    }
  ]
}
JSON
aws iam put-role-policy --role-name "$ECS_TASK_ROLE_NAME" --policy-name "${APP_NAME}-ses-email" --policy-document "file://$SES_POLICY" >/dev/null
EXECUTION_ROLE_ARN="$(aws iam get-role --role-name "$ECS_EXECUTION_ROLE_NAME" --query Role.Arn --output text)"
TASK_ROLE_ARN="$(aws iam get-role --role-name "$ECS_TASK_ROLE_NAME" --query Role.Arn --output text)"

aws iam get-role --role-name "$ECS_INSTANCE_ROLE_NAME" >/dev/null 2>&1 || \
  aws iam create-role --role-name "$ECS_INSTANCE_ROLE_NAME" --assume-role-policy-document "file://$ECS_INSTANCE_TRUST" >/dev/null
aws iam attach-role-policy \
  --role-name "$ECS_INSTANCE_ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role >/dev/null
if ! aws iam get-instance-profile --instance-profile-name "$ECS_INSTANCE_PROFILE_NAME" >/dev/null 2>&1; then
  aws iam create-instance-profile --instance-profile-name "$ECS_INSTANCE_PROFILE_NAME" >/dev/null
fi
PROFILE_ROLE_COUNT="$(aws iam get-instance-profile --instance-profile-name "$ECS_INSTANCE_PROFILE_NAME" --query "length(InstanceProfile.Roles[?RoleName=='$ECS_INSTANCE_ROLE_NAME'])" --output text)"
if [[ "$PROFILE_ROLE_COUNT" == "0" ]]; then
  aws iam add-role-to-instance-profile --instance-profile-name "$ECS_INSTANCE_PROFILE_NAME" --role-name "$ECS_INSTANCE_ROLE_NAME" >/dev/null
  sleep 10
fi
rm -f "$ECS_TASK_TRUST" "$ECS_INSTANCE_TRUST" "$S3_POLICY" "$SES_POLICY"

echo "==> Creating PostgreSQL database"
DEFAULT_VPC_ID="$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)"
if [[ -z "$DEFAULT_VPC_ID" || "$DEFAULT_VPC_ID" == "None" ]]; then
  echo "No default VPC found in $AWS_REGION; creating one for the low-cost RDS deployment"
  DEFAULT_VPC_ID="$(aws ec2 create-default-vpc --query Vpc.VpcId --output text)"
fi
read -r -a DEFAULT_SUBNET_IDS <<< "$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$DEFAULT_VPC_ID" --query 'Subnets[].SubnetId' --output text)"
if [[ "${#DEFAULT_SUBNET_IDS[@]}" -eq 0 ]]; then
  echo "No subnets found in default VPC $DEFAULT_VPC_ID" >&2
  exit 1
fi
DB_SECURITY_GROUP_ID="${DB_SECURITY_GROUP_ID:-$(aws ec2 describe-security-groups --filters Name=group-name,Values=${APP_NAME}-db Name=vpc-id,Values=$DEFAULT_VPC_ID --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true)}"
if [[ -z "$DB_SECURITY_GROUP_ID" || "$DB_SECURITY_GROUP_ID" == "None" ]]; then
  DB_SECURITY_GROUP_ID="$(aws ec2 create-security-group --group-name "${APP_NAME}-db" --description "${APP_NAME} PostgreSQL access" --vpc-id "$DEFAULT_VPC_ID" --query GroupId --output text)"
  aws ec2 authorize-security-group-ingress --group-id "$DB_SECURITY_GROUP_ID" --protocol tcp --port 5432 --cidr 0.0.0.0/0 >/dev/null || true
fi

ALB_SECURITY_GROUP_ID="$(aws ec2 describe-security-groups --filters Name=group-name,Values="$ALB_SECURITY_GROUP_NAME" Name=vpc-id,Values="$DEFAULT_VPC_ID" --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true)"
if [[ -z "$ALB_SECURITY_GROUP_ID" || "$ALB_SECURITY_GROUP_ID" == "None" ]]; then
  ALB_SECURITY_GROUP_ID="$(aws ec2 create-security-group --group-name "$ALB_SECURITY_GROUP_NAME" --description "${APP_NAME} public API load balancer" --vpc-id "$DEFAULT_VPC_ID" --query GroupId --output text)"
fi
aws ec2 authorize-security-group-ingress --group-id "$ALB_SECURITY_GROUP_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0 >/dev/null 2>&1 || true

ECS_SECURITY_GROUP_ID="$(aws ec2 describe-security-groups --filters Name=group-name,Values="$ECS_SECURITY_GROUP_NAME" Name=vpc-id,Values="$DEFAULT_VPC_ID" --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true)"
if [[ -z "$ECS_SECURITY_GROUP_ID" || "$ECS_SECURITY_GROUP_ID" == "None" ]]; then
  ECS_SECURITY_GROUP_ID="$(aws ec2 create-security-group --group-name "$ECS_SECURITY_GROUP_NAME" --description "${APP_NAME} ECS API tasks" --vpc-id "$DEFAULT_VPC_ID" --query GroupId --output text)"
fi
aws ec2 authorize-security-group-ingress --group-id "$ECS_SECURITY_GROUP_ID" --protocol tcp --port "$API_CONTAINER_PORT" --source-group "$ALB_SECURITY_GROUP_ID" >/dev/null 2>&1 || true
aws ec2 authorize-security-group-ingress --group-id "$DB_SECURITY_GROUP_ID" --protocol tcp --port 5432 --source-group "$ECS_SECURITY_GROUP_ID" >/dev/null 2>&1 || true

if [[ "$REDIS_ENABLED" == "true" ]]; then
  REDIS_SECURITY_GROUP_ID="$(aws ec2 describe-security-groups --filters Name=group-name,Values="$REDIS_SECURITY_GROUP_NAME" Name=vpc-id,Values="$DEFAULT_VPC_ID" --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true)"
  if [[ -z "$REDIS_SECURITY_GROUP_ID" || "$REDIS_SECURITY_GROUP_ID" == "None" ]]; then
    REDIS_SECURITY_GROUP_ID="$(aws ec2 create-security-group --group-name "$REDIS_SECURITY_GROUP_NAME" --description "${APP_NAME} Redis access" --vpc-id "$DEFAULT_VPC_ID" --query GroupId --output text)"
  fi
  aws ec2 authorize-security-group-ingress --group-id "$REDIS_SECURITY_GROUP_ID" --protocol tcp --port "$REDIS_PORT" --source-group "$ECS_SECURITY_GROUP_ID" >/dev/null 2>&1 || true

  echo "==> Creating Redis cache"
  if ! aws elasticache describe-cache-subnet-groups --cache-subnet-group-name "$REDIS_SUBNET_GROUP_NAME" >/dev/null 2>&1; then
    aws elasticache create-cache-subnet-group \
      --cache-subnet-group-name "$REDIS_SUBNET_GROUP_NAME" \
      --cache-subnet-group-description "${APP_NAME} Redis subnets" \
      --subnet-ids "${DEFAULT_SUBNET_IDS[@]}" >/dev/null
  fi

  if ! aws elasticache describe-cache-clusters --cache-cluster-id "$REDIS_CLUSTER_ID" >/dev/null 2>&1; then
    aws elasticache create-cache-cluster \
      --cache-cluster-id "$REDIS_CLUSTER_ID" \
      --engine redis \
      --cache-node-type "$REDIS_NODE_TYPE" \
      --num-cache-nodes 1 \
      --cache-subnet-group-name "$REDIS_SUBNET_GROUP_NAME" \
      --security-group-ids "$REDIS_SECURITY_GROUP_ID" \
      --port "$REDIS_PORT" >/dev/null
  fi
  aws elasticache wait cache-cluster-available --cache-cluster-id "$REDIS_CLUSTER_ID"
  REDIS_HOST="$(aws elasticache describe-cache-clusters --cache-cluster-id "$REDIS_CLUSTER_ID" --show-cache-node-info --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' --output text)"
  REDIS_PORT="$(aws elasticache describe-cache-clusters --cache-cluster-id "$REDIS_CLUSTER_ID" --show-cache-node-info --query 'CacheClusters[0].CacheNodes[0].Endpoint.Port' --output text)"
  REDIS_CONNECTION_STRING="${REDIS_HOST}:${REDIS_PORT},abortConnect=false"
else
  REDIS_CONNECTION_STRING=""
fi

if ! aws rds describe-db-instances --db-instance-identifier "$DB_INSTANCE_ID" >/dev/null 2>&1; then
  aws rds create-db-instance \
    --db-instance-identifier "$DB_INSTANCE_ID" \
    --db-instance-class "$DB_INSTANCE_CLASS" \
    --engine postgres \
    --allocated-storage "$DB_ALLOCATED_STORAGE" \
    --master-username "$DB_USER" \
    --master-user-password "$DB_PASS" \
    --db-name "$DB_NAME" \
    --vpc-security-group-ids "$DB_SECURITY_GROUP_ID" \
    --publicly-accessible \
    --backup-retention-period 1 \
    --no-multi-az \
    --storage-type gp3 >/dev/null
fi
aws rds wait db-instance-available --db-instance-identifier "$DB_INSTANCE_ID"
DB_HOST="$(aws rds describe-db-instances --db-instance-identifier "$DB_INSTANCE_ID" --query 'DBInstances[0].Endpoint.Address' --output text)"
DB_CONN="Host=${DB_HOST};Port=5432;Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASS};Ssl Mode=Require;Trust Server Certificate=true"

WEB_ORIGIN="${WEB_PUBLIC_ORIGIN:-http://${WEB_BUCKET}.s3-website-${AWS_REGION}.amazonaws.com}"
ADMIN_ORIGIN="${ADMIN_PUBLIC_ORIGIN:-http://${ADMIN_BUCKET}.s3-website-${AWS_REGION}.amazonaws.com}"

echo "==> Deploying API to ECS on EC2"
aws logs create-log-group --log-group-name "$LOG_GROUP_NAME" >/dev/null 2>&1 || true

ECS_CLUSTER_STATUS="$(aws ecs describe-clusters --clusters "$ECS_CLUSTER_NAME" --query 'clusters[0].status' --output text 2>/dev/null || true)"
if [[ "$ECS_CLUSTER_STATUS" != "ACTIVE" ]]; then
  aws ecs create-cluster --cluster-name "$ECS_CLUSTER_NAME" >/dev/null
fi
echo "    ECS cluster ready: $ECS_CLUSTER_NAME"

if [[ -z "$ECS_EC2_AMI_ID" ]]; then
  ECS_EC2_AMI_ID="$(aws ssm get-parameter \
    --name /aws/service/ecs/optimized-ami/amazon-linux-2/recommended/image_id \
    --query Parameter.Value \
    --output text)"
fi

ECS_EC2_USER_DATA="$(mktemp)"
cat > "$ECS_EC2_USER_DATA" <<EOF
#!/bin/bash
echo ECS_CLUSTER=${ECS_CLUSTER_NAME} >> /etc/ecs/ecs.config
EOF

ECS_EC2_INSTANCE_ID="$(aws ec2 describe-instances \
  --filters \
    Name=tag:Name,Values="$ECS_EC2_INSTANCE_NAME" \
    Name=tag:ECSCluster,Values="$ECS_CLUSTER_NAME" \
    Name=instance-state-name,Values=pending,running,stopping,stopped \
  --query 'Reservations[].Instances[].InstanceId | [0]' \
  --output text 2>/dev/null || true)"

ECS_EC2_INSTANCE_REUSED=0
if [[ -z "$ECS_EC2_INSTANCE_ID" || "$ECS_EC2_INSTANCE_ID" == "None" ]]; then
  ECS_EC2_INSTANCE_ID="$(aws ec2 run-instances \
    --image-id "$ECS_EC2_AMI_ID" \
    --instance-type "$ECS_EC2_INSTANCE_TYPE" \
    --iam-instance-profile Name="$ECS_INSTANCE_PROFILE_NAME" \
    --subnet-id "${DEFAULT_SUBNET_IDS[0]}" \
    --security-group-ids "$ECS_SECURITY_GROUP_ID" \
    --user-data "file://$ECS_EC2_USER_DATA" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$ECS_EC2_INSTANCE_NAME},{Key=App,Value=$APP_NAME},{Key=ECSCluster,Value=$ECS_CLUSTER_NAME}]" \
    --query 'Instances[0].InstanceId' \
    --output text)"
else
  ECS_EC2_INSTANCE_REUSED=1
  ECS_EC2_INSTANCE_STATE="$(aws ec2 describe-instances --instance-ids "$ECS_EC2_INSTANCE_ID" --query 'Reservations[0].Instances[0].State.Name' --output text)"
  if [[ "$ECS_EC2_INSTANCE_STATE" == "stopped" ]]; then
    aws ec2 start-instances --instance-ids "$ECS_EC2_INSTANCE_ID" >/dev/null
  fi
fi
rm -f "$ECS_EC2_USER_DATA"

aws ec2 wait instance-running --instance-ids "$ECS_EC2_INSTANCE_ID"
echo "    ECS EC2 instance ready: $ECS_EC2_INSTANCE_ID ($ECS_EC2_INSTANCE_TYPE)"

wait_for_ecs_container_instance() {
  local attempt
  for attempt in {1..40}; do
    ECS_CONTAINER_INSTANCE_COUNT="$(aws ecs list-container-instances \
      --cluster "$ECS_CLUSTER_NAME" \
      --filter "ec2InstanceId == $ECS_EC2_INSTANCE_ID" \
      --query 'length(containerInstanceArns)' \
      --output text 2>/dev/null || echo 0)"
    if [[ "$ECS_CONTAINER_INSTANCE_COUNT" != "0" ]]; then
      return 0
    fi
    sleep 10
  done
  return 1
}

if ! wait_for_ecs_container_instance; then
  if [[ "$ECS_EC2_INSTANCE_REUSED" == "1" ]]; then
    echo "    ECS instance has not registered yet; rebooting existing EC2 host to restart the ECS agent"
    aws ec2 reboot-instances --instance-ids "$ECS_EC2_INSTANCE_ID"
    aws ec2 wait instance-running --instance-ids "$ECS_EC2_INSTANCE_ID"
  fi
  if ! wait_for_ecs_container_instance; then
    ECS_CLUSTER_STATUS="$(aws ecs describe-clusters --clusters "$ECS_CLUSTER_NAME" --query 'clusters[0].status' --output text 2>/dev/null || true)"
    echo "EC2 instance $ECS_EC2_INSTANCE_ID did not register with ECS cluster $ECS_CLUSTER_NAME (cluster status: $ECS_CLUSTER_STATUS)" >&2
    echo "Check the EC2 system log for ECS agent errors and verify the $ECS_INSTANCE_PROFILE_NAME instance profile has AmazonEC2ContainerServiceforEC2Role." >&2
    exit 1
  fi
fi
echo "    ECS container instance registered"

ALB_ARN="$(aws elbv2 describe-load-balancers --names "$ALB_NAME" --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null || true)"
if [[ -z "$ALB_ARN" || "$ALB_ARN" == "None" ]]; then
  ALB_ARN="$(aws elbv2 create-load-balancer \
    --name "$ALB_NAME" \
    --subnets "${DEFAULT_SUBNET_IDS[@]}" \
    --security-groups "$ALB_SECURITY_GROUP_ID" \
    --scheme internet-facing \
    --type application \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text)"
fi
aws elbv2 wait load-balancer-available --load-balancer-arns "$ALB_ARN"
ALB_DNS_NAME="$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" --query 'LoadBalancers[0].DNSName' --output text)"
echo "    Load balancer ready: $ALB_DNS_NAME"

echo "==> Creating CloudFront distributions"
WEB_ORIGIN="${WEB_PUBLIC_ORIGIN:-$(ensure_static_cloudfront_distribution "$WEB_CLOUDFRONT_COMMENT" "$WEB_BUCKET")}"
ADMIN_ORIGIN="${ADMIN_PUBLIC_ORIGIN:-$(ensure_static_cloudfront_distribution "$ADMIN_CLOUDFRONT_COMMENT" "$ADMIN_BUCKET")}"
API_URL="${API_PUBLIC_ORIGIN:-$(ensure_api_cloudfront_distribution "$API_CLOUDFRONT_COMMENT" "$ALB_DNS_NAME")}"
echo "    Web CloudFront: $WEB_ORIGIN"
echo "    Admin CloudFront: $ADMIN_ORIGIN"
echo "    API CloudFront: $API_URL"

TARGET_GROUP_ARN="$(aws elbv2 describe-target-groups --names "$ALB_TARGET_GROUP_NAME" --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || true)"
if [[ -z "$TARGET_GROUP_ARN" || "$TARGET_GROUP_ARN" == "None" ]]; then
  TARGET_GROUP_ARN="$(aws elbv2 create-target-group \
    --name "$ALB_TARGET_GROUP_NAME" \
    --protocol HTTP \
    --port "$API_CONTAINER_PORT" \
    --vpc-id "$DEFAULT_VPC_ID" \
    --target-type instance \
    --health-check-protocol HTTP \
    --health-check-path /health \
    --matcher HttpCode=200-399 \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)"
else
  TARGET_GROUP_TYPE="$(aws elbv2 describe-target-groups --target-group-arns "$TARGET_GROUP_ARN" --query 'TargetGroups[0].TargetType' --output text)"
  if [[ "$TARGET_GROUP_TYPE" != "instance" ]]; then
    echo "Target group $ALB_TARGET_GROUP_NAME has target type $TARGET_GROUP_TYPE. Set ALB_TARGET_GROUP_NAME to a new name for ECS EC2." >&2
    exit 1
  fi
fi
echo "    Target group ready: $ALB_TARGET_GROUP_NAME"

LISTENER_ARN="$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --query 'Listeners[?Port==`80`].ListenerArn | [0]' --output text 2>/dev/null || true)"
if [[ -z "$LISTENER_ARN" || "$LISTENER_ARN" == "None" ]]; then
  aws elbv2 create-listener \
    --load-balancer-arn "$ALB_ARN" \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn="$TARGET_GROUP_ARN" >/dev/null
else
  aws elbv2 modify-listener \
    --listener-arn "$LISTENER_ARN" \
    --default-actions Type=forward,TargetGroupArn="$TARGET_GROUP_ARN" >/dev/null
fi
echo "    HTTP listener ready"

TASK_DEFINITION="$(mktemp)"
jq -n \
  --arg family "$ECS_TASK_FAMILY" \
  --arg executionRoleArn "$EXECUTION_ROLE_ARN" \
  --arg taskRoleArn "$TASK_ROLE_ARN" \
  --arg cpu "$ECS_CPU" \
  --arg memory "$ECS_MEMORY" \
  --arg containerName "$API_CONTAINER_NAME" \
  --argjson containerPort "$API_CONTAINER_PORT" \
  --arg image "$ECR_URI:$IMAGE_TAG" \
  --arg awsRegion "$AWS_REGION" \
  --arg logGroup "$LOG_GROUP_NAME" \
  --arg docsBucket "$DOCS_BUCKET" \
  --arg dbConn "$DB_CONN" \
  --arg jwtSecret "$JWT_SECRET" \
  --arg redisEnabled "$REDIS_ENABLED" \
  --arg redisConnectionString "$REDIS_CONNECTION_STRING" \
  --arg redisInstanceName "$REDIS_INSTANCE_NAME" \
  --arg cacheDashboardStatsSeconds "${CACHE_DASHBOARD_STATS_SECONDS:-60}" \
  --arg cacheAnalyticsSummarySeconds "${CACHE_ANALYTICS_SUMMARY_SECONDS:-300}" \
  --arg cacheGeneratedResultSeconds "${CACHE_GENERATED_RESULT_SECONDS:-3600}" \
  --arg documentUploadLimit "${DOCUMENT_UPLOAD_LIMIT:-20}" \
  --arg youtubeSubtitleLanguages "${YOUTUBE_SUBTITLE_LANGUAGES:-en.*,en}" \
  --arg youtubeProxyUrl "$YOUTUBE_PROXY_URL" \
  --arg youtubeCookiesBase64 "$YOUTUBE_COOKIES_B64" \
  --arg youtubeHttpTimeoutSeconds "${YOUTUBE_HTTP_TIMEOUT_SECONDS:-60}" \
  --arg googleClientId "$GOOGLE_CLIENT_ID" \
  --arg googleClientSecret "$GOOGLE_CLIENT_SECRET" \
  --arg githubClientId "$GITHUB_CLIENT_ID" \
  --arg githubClientSecret "$GITHUB_CLIENT_SECRET" \
  --arg emailProvider "$EMAIL_PROVIDER" \
  --arg emailFrom "$EMAIL_FROM" \
  --arg sesRegion "$SES_REGION" \
  --arg smtpUser "$SMTP_USER" \
  --arg smtpPassword "$SMTP_PASSWORD" \
  --arg webOrigin "$WEB_ORIGIN" \
  --arg adminOrigin "$ADMIN_ORIGIN" \
  '{
    family: $family,
    networkMode: "bridge",
    requiresCompatibilities: ["EC2"],
    cpu: $cpu,
    memory: $memory,
    executionRoleArn: $executionRoleArn,
    taskRoleArn: $taskRoleArn,
    containerDefinitions: [
      {
        name: $containerName,
        image: $image,
        essential: true,
        portMappings: [
          {
            containerPort: $containerPort,
            hostPort: $containerPort,
            protocol: "tcp"
          }
        ],
        environment: ({
          ASPNETCORE_ENVIRONMENT: "Production",
          AWS__Region: $awsRegion,
          S3__BucketName: $docsBucket,
          ConnectionStrings__DefaultConnection: $dbConn,
          JwtSettings__SecretKey: $jwtSecret,
          JwtSettings__Issuer: "Study Platform",
          JwtSettings__Audience: "Study Platform Users",
          Redis__Enabled: $redisEnabled,
          Redis__ConnectionString: $redisConnectionString,
          Redis__InstanceName: $redisInstanceName,
          Cache__DashboardStatsSeconds: $cacheDashboardStatsSeconds,
          Cache__AnalyticsSummarySeconds: $cacheAnalyticsSummarySeconds,
          Cache__GeneratedResultSeconds: $cacheGeneratedResultSeconds,
          AppLimits__DocumentUploadLimit: $documentUploadLimit,
          YouTube__SubtitleLanguages: $youtubeSubtitleLanguages,
          YouTube__ProxyUrl: $youtubeProxyUrl,
          YouTube__CookiesBase64: $youtubeCookiesBase64,
          YouTube__HttpTimeoutSeconds: $youtubeHttpTimeoutSeconds,
          GoogleOAuth__ClientId: $googleClientId,
          GoogleOAuth__ClientSecret: $googleClientSecret,
          GitHubOAuth__ClientId: $githubClientId,
          GitHubOAuth__ClientSecret: $githubClientSecret,
          EmailSettings__Provider: $emailProvider,
          EmailSettings__FromEmail: $emailFrom,
          EmailSettings__SesRegion: $sesRegion,
          EmailSettings__SmtpHost: "smtp.gmail.com",
          EmailSettings__SmtpPort: "587",
          EmailSettings__SmtpUser: $smtpUser,
          EmailSettings__SmtpPassword: $smtpPassword,
          Cors__AllowedOrigins__0: $webOrigin,
          Cors__AllowedOrigins__1: $adminOrigin
        } | to_entries | map({name: .key, value: .value})),
        logConfiguration: {
          logDriver: "awslogs",
          options: {
            "awslogs-group": $logGroup,
            "awslogs-region": $awsRegion,
            "awslogs-stream-prefix": $containerName
          }
        }
      }
    ]
  }' > "$TASK_DEFINITION"
TASK_DEFINITION_ARN="$(aws ecs register-task-definition --cli-input-json "file://$TASK_DEFINITION" --query 'taskDefinition.taskDefinitionArn' --output text)"
rm -f "$TASK_DEFINITION"
echo "    Task definition registered: $TASK_DEFINITION_ARN"

SERVICE_ARN="$(aws ecs describe-services --cluster "$ECS_CLUSTER_NAME" --services "$ECS_SERVICE_NAME" --query 'services[0].serviceArn' --output text 2>/dev/null || true)"
if [[ -n "$SERVICE_ARN" && "$SERVICE_ARN" != "None" ]]; then
  SERVICE_STATUS="$(aws ecs describe-services --cluster "$ECS_CLUSTER_NAME" --services "$ECS_SERVICE_NAME" --query 'services[0].status' --output text 2>/dev/null || true)"
  if [[ "$SERVICE_STATUS" != "ACTIVE" && "$SERVICE_STATUS" != "DRAINING" ]]; then
    SERVICE_ARN=""
  fi
fi
if [[ -n "$SERVICE_ARN" && "$SERVICE_ARN" != "None" ]]; then
  SERVICE_LAUNCH_TYPE="$(aws ecs describe-services --cluster "$ECS_CLUSTER_NAME" --services "$ECS_SERVICE_NAME" --query 'services[0].launchType' --output text 2>/dev/null || true)"
  if [[ "$SERVICE_LAUNCH_TYPE" == "FARGATE" ]]; then
    echo "    Existing Fargate service found; replacing it with ECS EC2"
    aws ecs update-service --cluster "$ECS_CLUSTER_NAME" --service "$ECS_SERVICE_NAME" --desired-count 0 >/dev/null
    aws ecs delete-service --cluster "$ECS_CLUSTER_NAME" --service "$ECS_SERVICE_NAME" --force >/dev/null
    aws ecs wait services-inactive --cluster "$ECS_CLUSTER_NAME" --services "$ECS_SERVICE_NAME"
    SERVICE_ARN=""
  fi
fi
if [[ -z "$SERVICE_ARN" || "$SERVICE_ARN" == "None" ]]; then
  SERVICE_ARN="$(aws ecs create-service \
    --cluster "$ECS_CLUSTER_NAME" \
    --service-name "$ECS_SERVICE_NAME" \
    --task-definition "$TASK_DEFINITION_ARN" \
    --desired-count "$ECS_DESIRED_COUNT" \
    --launch-type EC2 \
    --load-balancers "targetGroupArn=$TARGET_GROUP_ARN,containerName=$API_CONTAINER_NAME,containerPort=$API_CONTAINER_PORT" \
    --health-check-grace-period-seconds 120 \
    --query 'service.serviceArn' \
    --output text)"
else
  aws ecs update-service \
    --cluster "$ECS_CLUSTER_NAME" \
    --service "$ECS_SERVICE_NAME" \
    --task-definition "$TASK_DEFINITION_ARN" \
    --desired-count "$ECS_DESIRED_COUNT" \
    --force-new-deployment >/dev/null
fi
echo "    ECS service deploying: $ECS_SERVICE_NAME"
aws ecs wait services-stable --cluster "$ECS_CLUSTER_NAME" --services "$ECS_SERVICE_NAME"

if [[ "${DEPLOY_BACKEND_ONLY:-0}" == "1" ]]; then
  echo ""
  echo "Backend deployment complete"
  echo "  Image: $ECR_URI:$IMAGE_TAG"
  echo "  API:   $API_URL"
  exit 0
fi

echo "==> Building web frontend"
(
  cd web
  npm ci
  VITE_API_URL="$API_URL" \
  VITE_SHARE_BASE_URL="$WEB_ORIGIN" \
  VITE_GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
  VITE_GITHUB_CLIENT_ID="$GITHUB_CLIENT_ID" \
  npm run build
)
aws s3 sync web/dist "s3://$WEB_BUCKET" --delete
invalidate_cloudfront_by_comment "$WEB_CLOUDFRONT_COMMENT"

echo "==> Building admin frontend"
(
  cd admin
  npm ci
  VITE_API_URL="$API_URL" npm run build
)
aws s3 sync admin/dist "s3://$ADMIN_BUCKET" --delete
invalidate_cloudfront_by_comment "$ADMIN_CLOUDFRONT_COMMENT"

echo ""
echo "Deployment complete"
echo "  Web:   $WEB_ORIGIN"
echo "  Admin: $ADMIN_ORIGIN"
echo "  API:   $API_URL"
echo "  Docs:  s3://$DOCS_BUCKET"
