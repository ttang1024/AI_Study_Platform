#!/bin/bash
set -euo pipefail

# Low-cost Azure deployment for a $200 credit/free account:
# - API: one Azure Container App, scales to zero when idle.
# - Web/Admin: Azure Storage static websites, no frontend containers.
# - Database: smallest PostgreSQL Flexible Server used by this app.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.azure_env_variables" ]]; then
  # shellcheck source=.azure_env_variables
  source "$SCRIPT_DIR/.azure_env_variables"
fi

RESOURCE_GROUP="${RESOURCE_GROUP:-study-platform-rg}"
LOCATION="${LOCATION:-eastus}"
DB_LOCATION="${DB_LOCATION:-westus3}"
DB_USER="${DB_USER:-studyplatform}"
DB_NAME="${DB_NAME:-studyplatform}"
API_APP_NAME="${API_APP_NAME:-api}"
ENVIRONMENT="${ENVIRONMENT:-study-platform-env}"
DB_SKU="${DB_SKU:-Standard_B1ms}"

DB_PASS="${DB_PASS:?Set DB_PASS env var}"
JWT_SECRET="${JWT_SECRET:?Set JWT_SECRET env var}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:?Set GOOGLE_CLIENT_ID env var}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:?Set GOOGLE_CLIENT_SECRET env var}"
GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID:?Set GITHUB_CLIENT_ID env var}"
GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET:?Set GITHUB_CLIENT_SECRET env var}"
SMTP_USER="${SMTP_USER:?Set SMTP_USER env var}"
SMTP_PASSWORD="${SMTP_PASSWORD:?Set SMTP_PASSWORD env var}"

strip_cr() {
  printf '%s' "$1" | tr -d '\r'
}

validate_storage_connection_string() {
  local value="$1"
  if [[ "$value" != *"DefaultEndpointsProtocol="* || "$value" != *"AccountName="* || "$value" != *"AccountKey="* || "$value" != *"EndpointSuffix="* ]]; then
    echo "Azure Storage connection string is invalid. Unset AZURE_STORAGE_CONNECTION_STRING to auto-read it from $DOCS_STORAGE_ACCOUNT, or set a full connection string." >&2
    exit 1
  fi
}

DB_PASS="$(strip_cr "$DB_PASS")"
JWT_SECRET="$(strip_cr "$JWT_SECRET")"
GOOGLE_CLIENT_ID="$(strip_cr "$GOOGLE_CLIENT_ID")"
GOOGLE_CLIENT_SECRET="$(strip_cr "$GOOGLE_CLIENT_SECRET")"
GITHUB_CLIENT_ID="$(strip_cr "$GITHUB_CLIENT_ID")"
GITHUB_CLIENT_SECRET="$(strip_cr "$GITHUB_CLIENT_SECRET")"
SMTP_USER="$(strip_cr "$SMTP_USER")"
SMTP_PASSWORD="$(strip_cr "$SMTP_PASSWORD")"
YOUTUBE_PROXY_URL="${YOUTUBE_PROXY_URL:-${YouTube__ProxyUrl:-}}"
YOUTUBE_COOKIES_B64="${YOUTUBE_COOKIES_B64:-${YouTube__CookiesBase64:-}}"
YOUTUBE_PROXY_URL="$(strip_cr "$YOUTUBE_PROXY_URL")"
YOUTUBE_COOKIES_B64="$(strip_cr "$YOUTUBE_COOKIES_B64")"

if ! az account show >/dev/null 2>&1; then
  echo "==> Logging in to Azure"
  az login
fi

SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
DEFAULT_SUFFIX="$(printf "%s" "$SUBSCRIPTION_ID" | tr -d '-' | cut -c1-8)"
AZURE_NAME_SUFFIX="${AZURE_NAME_SUFFIX:-$DEFAULT_SUFFIX}"

ACR_NAME="${ACR_NAME:-studyplat${AZURE_NAME_SUFFIX}acr}"
DB_SERVER="${DB_SERVER:-study-platform-db-${AZURE_NAME_SUFFIX}}"
DOCS_STORAGE_ACCOUNT="${DOCS_STORAGE_ACCOUNT:-stplatdocs${AZURE_NAME_SUFFIX}}"
WEB_STORAGE_ACCOUNT="${WEB_STORAGE_ACCOUNT:-stplatweb${AZURE_NAME_SUFFIX}}"
ADMIN_STORAGE_ACCOUNT="${ADMIN_STORAGE_ACCOUNT:-stplatadmin${AZURE_NAME_SUFFIX}}"

COMMIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
IMAGE_TAG="${COMMIT_SHA}-$(date +%Y%m%d%H%M%S)"

echo "==> Creating resource group"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

echo "==> Creating storage accounts"
for account in "$DOCS_STORAGE_ACCOUNT" "$WEB_STORAGE_ACCOUNT" "$ADMIN_STORAGE_ACCOUNT"; do
  if ! az storage account show --name "$account" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
    az storage account create \
      --resource-group "$RESOURCE_GROUP" \
      --name "$account" \
      --location "$LOCATION" \
      --sku Standard_LRS \
      --kind StorageV2 \
      --min-tls-version TLS1_2 \
      --allow-blob-public-access true \
      --output none
  else
    echo "Storage account $account already exists, skipping"
  fi

  az storage account update \
    --resource-group "$RESOURCE_GROUP" \
    --name "$account" \
    --min-tls-version TLS1_2 \
    --output none
done

DOCS_STORAGE_KEY="$(az storage account keys list --resource-group "$RESOURCE_GROUP" --account-name "$DOCS_STORAGE_ACCOUNT" --query '[0].value' -o tsv)"
WEB_STORAGE_KEY="$(az storage account keys list --resource-group "$RESOURCE_GROUP" --account-name "$WEB_STORAGE_ACCOUNT" --query '[0].value' -o tsv)"
ADMIN_STORAGE_KEY="$(az storage account keys list --resource-group "$RESOURCE_GROUP" --account-name "$ADMIN_STORAGE_ACCOUNT" --query '[0].value' -o tsv)"

echo "==> Enabling static website hosting"
az storage blob service-properties update \
  --account-name "$WEB_STORAGE_ACCOUNT" \
  --account-key "$WEB_STORAGE_KEY" \
  --static-website \
  --index-document index.html \
  --404-document index.html \
  --output none
az storage blob service-properties update \
  --account-name "$ADMIN_STORAGE_ACCOUNT" \
  --account-key "$ADMIN_STORAGE_KEY" \
  --static-website \
  --index-document index.html \
  --404-document index.html \
  --output none

echo "==> Creating documents blob container"
az storage container create \
  --account-name "$DOCS_STORAGE_ACCOUNT" \
  --account-key "$DOCS_STORAGE_KEY" \
  --name documents \
  --output none
AZURE_STORAGE_CONNECTION_STRING="${AZURE_STORAGE_CONNECTION_STRING:-$(az storage account show-connection-string --resource-group "$RESOURCE_GROUP" --name "$DOCS_STORAGE_ACCOUNT" --query connectionString -o tsv)}"
AZURE_STORAGE_CONNECTION_STRING="$(strip_cr "$AZURE_STORAGE_CONNECTION_STRING")"
validate_storage_connection_string "$AZURE_STORAGE_CONNECTION_STRING"

echo "==> Creating Azure Container Registry"
if ! az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
  az acr create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$ACR_NAME" \
    --sku Basic \
    --admin-enabled true \
    --output none
else
  echo "ACR $ACR_NAME already exists, skipping"
fi

echo "==> Resolving Container Apps environment"
ENVIRONMENT_REF="$ENVIRONMENT"
if az containerapp env show --name "$ENVIRONMENT" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
  echo "Container Apps environment $ENVIRONMENT already exists in $RESOURCE_GROUP, reusing"
else
  LOCATION_DISPLAY="$(az account list-locations --query "[?name=='$LOCATION'].displayName | [0]" -o tsv 2>/dev/null || true)"
  EXISTING_ENV_ID="$(az containerapp env list --query "[?location=='$LOCATION'].id | [0]" -o tsv)"
  if [ -z "$EXISTING_ENV_ID" ] && [ -n "$LOCATION_DISPLAY" ] && [ "$LOCATION_DISPLAY" != "None" ]; then
    EXISTING_ENV_ID="$(az containerapp env list --query "[?location=='$LOCATION_DISPLAY'].id | [0]" -o tsv)"
  fi
  if [ -n "$EXISTING_ENV_ID" ]; then
    ENVIRONMENT_REF="$EXISTING_ENV_ID"
    echo "Reusing existing Container Apps environment for $LOCATION: $ENVIRONMENT_REF"
  else
    echo "Creating Container Apps environment $ENVIRONMENT in $LOCATION"
    az containerapp env create \
      --name "$ENVIRONMENT" \
      --resource-group "$RESOURCE_GROUP" \
      --location "$LOCATION" \
      --output none
  fi
fi

if [ "$ENVIRONMENT_REF" = "$ENVIRONMENT" ]; then
  ENVIRONMENT_REF="$(az containerapp env show --name "$ENVIRONMENT" --resource-group "$RESOURCE_GROUP" --query id -o tsv)"
fi

if [ -z "$ENVIRONMENT_REF" ]; then
  echo "Could not resolve a Container Apps environment. Set ENVIRONMENT to an existing environment name or deploy in another LOCATION."
  exit 1
fi

echo "==> Registering PostgreSQL provider"
az provider register --namespace Microsoft.DBforPostgreSQL --wait

echo "==> Checking PostgreSQL availability in $DB_LOCATION"
if ! az postgres flexible-server list-skus \
    --location "$DB_LOCATION" \
    --query "[0].supportedServerEditions[?name=='Burstable'].supportedServerSkus[] | [?name=='$DB_SKU'] | [0].name" \
    -o tsv | grep -q "$DB_SKU"; then
  echo "PostgreSQL Flexible Server SKU $DB_SKU is not available in $DB_LOCATION for this subscription."
  echo "Try another region, for example: DB_LOCATION=westus3 bash deploy.sh"
  exit 1
fi

echo "==> Creating managed PostgreSQL"
if ! az postgres flexible-server show --name "$DB_SERVER" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
  az postgres flexible-server create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DB_SERVER" \
    --location "$DB_LOCATION" \
    --admin-user "$DB_USER" \
    --admin-password "$DB_PASS" \
    --sku-name "$DB_SKU" \
    --tier Burstable \
    --version 17 \
    --storage-size 32 \
    --geo-redundant-backup Disabled \
    --public-access 0.0.0.0 \
    --yes \
    --output none
else
  echo "PostgreSQL server $DB_SERVER already exists, skipping"
fi

if ! az postgres flexible-server db show \
    --resource-group "$RESOURCE_GROUP" \
    --server-name "$DB_SERVER" \
    --database-name "$DB_NAME" >/dev/null 2>&1; then
  az postgres flexible-server db create \
    --resource-group "$RESOURCE_GROUP" \
    --server-name "$DB_SERVER" \
    --database-name "$DB_NAME" \
    --output none
else
  echo "Database $DB_NAME already exists, skipping"
fi

DB_CONN="Host=${DB_SERVER}.postgres.database.azure.com;Port=5432;Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASS};Ssl Mode=Require"

echo "==> Logging in to ACR and fetching credentials"
az acr login --name "$ACR_NAME"
ACR_SERVER="$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query loginServer -o tsv)"
ACR_USER="$(az acr credential show --name "$ACR_NAME" --query username -o tsv)"
ACR_PASS="$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)"

echo "==> Building and pushing API image"
docker build -t "$ACR_SERVER/api:$IMAGE_TAG" -t "$ACR_SERVER/api:latest" ./server
docker push "$ACR_SERVER/api:$IMAGE_TAG"
docker push "$ACR_SERVER/api:latest"

WEB_URL="$(az storage account show --name "$WEB_STORAGE_ACCOUNT" --resource-group "$RESOURCE_GROUP" --query primaryEndpoints.web -o tsv)"
ADMIN_URL="$(az storage account show --name "$ADMIN_STORAGE_ACCOUNT" --resource-group "$RESOURCE_GROUP" --query primaryEndpoints.web -o tsv)"
WEB_ORIGIN="${WEB_URL%/}"
ADMIN_ORIGIN="${ADMIN_URL%/}"
WEB_PUBLIC_ORIGIN="${WEB_PUBLIC_ORIGIN:-$WEB_ORIGIN}"
WEB_PUBLIC_ORIGIN="$(strip_cr "$WEB_PUBLIC_ORIGIN")"

echo "==> Deploying API container app"
API_ENV_VARS=(
  "ASPNETCORE_ENVIRONMENT=Production"
  "ConnectionStrings__DefaultConnection=$DB_CONN"
  "JwtSettings__SecretKey=$JWT_SECRET"
  "JwtSettings__Issuer=Study Platform"
  "JwtSettings__Audience=Study Platform Users"
  "AzureStorage__ConnectionString=$AZURE_STORAGE_CONNECTION_STRING"
  "AzureStorage__ContainerName=documents"
  "Redis__Enabled=${REDIS_ENABLED:-false}"
  "Redis__ConnectionString=${REDIS_CONNECTION_STRING:-}"
  "Redis__InstanceName=${REDIS_INSTANCE_NAME:-StudyPlatform:}"
  "Cache__DashboardStatsSeconds=${CACHE_DASHBOARD_STATS_SECONDS:-60}"
  "Cache__AnalyticsSummarySeconds=${CACHE_ANALYTICS_SUMMARY_SECONDS:-300}"
  "Cache__GeneratedResultSeconds=${CACHE_GENERATED_RESULT_SECONDS:-3600}"
  "AppLimits__DocumentUploadLimit=${DOCUMENT_UPLOAD_LIMIT:-20}"
  "YouTube__SubtitleLanguages=${YOUTUBE_SUBTITLE_LANGUAGES:-en.*,en}"
  "YouTube__ProxyUrl=${YOUTUBE_PROXY_URL:-}"
  "YouTube__CookiesBase64=${YOUTUBE_COOKIES_B64:-}"
  "YouTube__HttpTimeoutSeconds=${YOUTUBE_HTTP_TIMEOUT_SECONDS:-60}"
  "GoogleOAuth__ClientId=$GOOGLE_CLIENT_ID"
  "GoogleOAuth__ClientSecret=$GOOGLE_CLIENT_SECRET"
  "GitHubOAuth__ClientId=$GITHUB_CLIENT_ID"
  "GitHubOAuth__ClientSecret=$GITHUB_CLIENT_SECRET"
  "EmailSettings__FromEmail=$SMTP_USER"
  "EmailSettings__SmtpHost=smtp.gmail.com"
  "EmailSettings__SmtpPort=587"
  "EmailSettings__SmtpUser=$SMTP_USER"
  "EmailSettings__SmtpPassword=$SMTP_PASSWORD"
  "Cors__AllowedOrigins__0=$WEB_ORIGIN"
  "Cors__AllowedOrigins__1=$ADMIN_ORIGIN"
)

if [ "$WEB_PUBLIC_ORIGIN" != "$WEB_ORIGIN" ]; then
  API_ENV_VARS+=("Cors__AllowedOrigins__2=$WEB_PUBLIC_ORIGIN")
fi

while IFS= read -r var_name; do
  API_ENV_VARS+=("${var_name}=${!var_name}")
done < <(compgen -A variable YouTube__ProxyUrls__ | sort)

while IFS= read -r var_name; do
  API_ENV_VARS+=("${var_name}=${!var_name}")
done < <(compgen -A variable YouTube__CookiesList__ | sort)

if az containerapp show --name "$API_APP_NAME" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
  az containerapp update \
    --name "$API_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --image "$ACR_SERVER/api:$IMAGE_TAG" \
    --min-replicas 0 \
    --max-replicas 1 \
    --set-env-vars "${API_ENV_VARS[@]}" \
    --output none
else
  az containerapp create \
    --name "$API_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ENVIRONMENT_REF" \
    --image "$ACR_SERVER/api:$IMAGE_TAG" \
    --registry-server "$ACR_SERVER" \
    --registry-username "$ACR_USER" \
    --registry-password "$ACR_PASS" \
    --target-port 5000 \
    --ingress external \
    --min-replicas 0 \
    --max-replicas 1 \
    --cpu 0.25 \
    --memory 0.5Gi \
    --env-vars "${API_ENV_VARS[@]}" \
    --output none
fi

API_FQDN="$(az containerapp show --name "$API_APP_NAME" --resource-group "$RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv)"
API_URL="https://$API_FQDN"

echo "==> Building web frontend"
(
  cd web
  npm ci
  VITE_API_URL="$API_URL" \
  VITE_SHARE_BASE_URL="$WEB_PUBLIC_ORIGIN" \
  VITE_GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
  VITE_GITHUB_CLIENT_ID="$GITHUB_CLIENT_ID" \
  npm run build
)

echo "==> Uploading web frontend"
az storage blob delete-batch --account-name "$WEB_STORAGE_ACCOUNT" --account-key "$WEB_STORAGE_KEY" --source '$web' --output none
az storage blob upload-batch --account-name "$WEB_STORAGE_ACCOUNT" --account-key "$WEB_STORAGE_KEY" --destination '$web' --source web/dist --overwrite --output none

echo "==> Building admin frontend"
(
  cd admin
  npm ci
  VITE_API_URL="$API_URL" npm run build
)

echo "==> Uploading admin frontend"
az storage blob delete-batch --account-name "$ADMIN_STORAGE_ACCOUNT" --account-key "$ADMIN_STORAGE_KEY" --source '$web' --output none
az storage blob upload-batch --account-name "$ADMIN_STORAGE_ACCOUNT" --account-key "$ADMIN_STORAGE_KEY" --destination '$web' --source admin/dist --overwrite --output none

echo ""
echo "Deployment complete"
echo "  Web:   $WEB_PUBLIC_ORIGIN"
echo "  Admin: $ADMIN_ORIGIN"
echo "  API:   $API_URL"
echo ""
echo "Cost controls: API scales to zero, frontends use static website hosting, uploads are limited to ${DOCUMENT_UPLOAD_LIMIT:-20} documents per account."
