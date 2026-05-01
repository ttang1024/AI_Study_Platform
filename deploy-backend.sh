#!/bin/bash
set -euo pipefail

# Deploy only the API backend for the low-cost Azure layout.
RESOURCE_GROUP="${RESOURCE_GROUP:-study-platform-rg}"
API_APP_NAME="${API_APP_NAME:-api}"
DB_USER="${DB_USER:-studyplatform}"
DB_NAME="${DB_NAME:-studyplatform}"

DB_PASS="${DB_PASS:?Set DB_PASS env var}"
JWT_SECRET="${JWT_SECRET:?Set JWT_SECRET env var}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:?Set GOOGLE_CLIENT_ID env var}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:?Set GOOGLE_CLIENT_SECRET env var}"
GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID:?Set GITHUB_CLIENT_ID env var}"
GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET:?Set GITHUB_CLIENT_SECRET env var}"
SMTP_USER="${SMTP_USER:?Set SMTP_USER env var}"
SMTP_PASSWORD="${SMTP_PASSWORD:?Set SMTP_PASSWORD env var}"

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
DB_CONN="Host=${DB_SERVER}.postgres.database.azure.com;Port=5432;Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASS};Ssl Mode=Require"
AZURE_STORAGE_CONNECTION_STRING="${AZURE_STORAGE_CONNECTION_STRING:-$(az storage account show-connection-string --resource-group "$RESOURCE_GROUP" --name "$DOCS_STORAGE_ACCOUNT" --query connectionString -o tsv)}"

WEB_URL="$(az storage account show --name "$WEB_STORAGE_ACCOUNT" --resource-group "$RESOURCE_GROUP" --query primaryEndpoints.web -o tsv)"
ADMIN_URL="$(az storage account show --name "$ADMIN_STORAGE_ACCOUNT" --resource-group "$RESOURCE_GROUP" --query primaryEndpoints.web -o tsv)"
WEB_ORIGIN="${WEB_URL%/}"
ADMIN_ORIGIN="${ADMIN_URL%/}"

echo "==> Logging in to ACR"
az acr login --name "$ACR_NAME"
ACR_SERVER="$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query loginServer -o tsv)"

echo "==> Building API image"
docker build \
  -t "$ACR_SERVER/api:$IMAGE_TAG" \
  -t "$ACR_SERVER/api:latest" ./server

echo "==> Pushing API image"
docker push "$ACR_SERVER/api:$IMAGE_TAG"
docker push "$ACR_SERVER/api:latest"

echo "==> Updating API container app"
az containerapp update \
  --name "$API_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --image "$ACR_SERVER/api:$IMAGE_TAG" \
  --min-replicas 0 \
  --max-replicas 1 \
  --set-env-vars \
    "ASPNETCORE_ENVIRONMENT=Production" \
    "ConnectionStrings__DefaultConnection=$DB_CONN" \
    "JwtSettings__SecretKey=$JWT_SECRET" \
    "JwtSettings__Issuer=Study Platform" \
    "JwtSettings__Audience=Study Platform Users" \
    "AzureStorage__ConnectionString=$AZURE_STORAGE_CONNECTION_STRING" \
    "AzureStorage__ContainerName=documents" \
    "Redis__ConnectionString=${REDIS_CONNECTION_STRING:-}" \
    "Redis__InstanceName=${REDIS_INSTANCE_NAME:-StudyPlatform:}" \
    "Cache__DashboardStatsSeconds=${CACHE_DASHBOARD_STATS_SECONDS:-60}" \
    "Cache__DocumentMetadataSeconds=${CACHE_DOCUMENT_METADATA_SECONDS:-60}" \
    "Cache__AnalyticsSummarySeconds=${CACHE_ANALYTICS_SUMMARY_SECONDS:-300}" \
    "Cache__GeneratedResultSeconds=${CACHE_GENERATED_RESULT_SECONDS:-3600}" \
    "AppLimits__DocumentUploadLimit=${DOCUMENT_UPLOAD_LIMIT:-5}" \
    "YouTube__SubtitleLanguages=${YOUTUBE_SUBTITLE_LANGUAGES:-en.*,en}" \
    "YouTube__ProxyUrl=${YOUTUBE_PROXY_URL:-}" \
    "YouTube__CookiesBase64=${YOUTUBE_COOKIES_B64:-}" \
    "YouTube__HttpTimeoutSeconds=${YOUTUBE_HTTP_TIMEOUT_SECONDS:-60}" \
    "GoogleOAuth__ClientId=$GOOGLE_CLIENT_ID" \
    "GoogleOAuth__ClientSecret=$GOOGLE_CLIENT_SECRET" \
    "GitHubOAuth__ClientId=$GITHUB_CLIENT_ID" \
    "GitHubOAuth__ClientSecret=$GITHUB_CLIENT_SECRET" \
    "EmailSettings__FromEmail=$SMTP_USER" \
    "EmailSettings__SmtpHost=smtp.gmail.com" \
    "EmailSettings__SmtpPort=587" \
    "EmailSettings__SmtpUser=$SMTP_USER" \
    "EmailSettings__SmtpPassword=$SMTP_PASSWORD" \
    "Cors__AllowedOrigins__0=$WEB_ORIGIN" \
    "Cors__AllowedOrigins__1=$ADMIN_ORIGIN" \
  --output none

API_FQDN="$(az containerapp show \
  --name "$API_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query properties.configuration.ingress.fqdn -o tsv)"

echo ""
echo "Backend deployment complete"
echo "  Image: $ACR_SERVER/api:$IMAGE_TAG"
echo "  API: https://$API_FQDN"
