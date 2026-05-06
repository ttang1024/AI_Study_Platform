#!/bin/bash
set -euo pipefail

# Deploy static web/admin frontends for the low-cost Azure layout.
RESOURCE_GROUP="${RESOURCE_GROUP:-study-platform-rg}"
API_APP_NAME="${API_APP_NAME:-api}"

GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:?Set GOOGLE_CLIENT_ID env var}"
GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID:?Set GITHUB_CLIENT_ID env var}"

if ! az account show >/dev/null 2>&1; then
  echo "==> Logging in to Azure"
  az login
fi

SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
DEFAULT_SUFFIX="$(printf "%s" "$SUBSCRIPTION_ID" | tr -d '-' | cut -c1-8)"
AZURE_NAME_SUFFIX="${AZURE_NAME_SUFFIX:-$DEFAULT_SUFFIX}"

WEB_STORAGE_ACCOUNT="${WEB_STORAGE_ACCOUNT:-stplatweb${AZURE_NAME_SUFFIX}}"
ADMIN_STORAGE_ACCOUNT="${ADMIN_STORAGE_ACCOUNT:-stplatadmin${AZURE_NAME_SUFFIX}}"
WEB_STORAGE_KEY="$(az storage account keys list --resource-group "$RESOURCE_GROUP" --account-name "$WEB_STORAGE_ACCOUNT" --query '[0].value' -o tsv)"
ADMIN_STORAGE_KEY="$(az storage account keys list --resource-group "$RESOURCE_GROUP" --account-name "$ADMIN_STORAGE_ACCOUNT" --query '[0].value' -o tsv)"
WEB_URL="$(az storage account show --name "$WEB_STORAGE_ACCOUNT" --resource-group "$RESOURCE_GROUP" --query primaryEndpoints.web -o tsv)"
WEB_ORIGIN="${WEB_PUBLIC_ORIGIN:-${WEB_URL%/}}"

API_FQDN="$(az containerapp show --name "$API_APP_NAME" --resource-group "$RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv)"
API_URL="https://$API_FQDN"

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

ADMIN_URL="$(az storage account show --name "$ADMIN_STORAGE_ACCOUNT" --resource-group "$RESOURCE_GROUP" --query primaryEndpoints.web -o tsv)"

echo ""
echo "Frontend deployment complete"
echo "  Web:   ${WEB_URL%/}"
echo "  Admin: ${ADMIN_URL%/}"
echo "  API:   $API_URL"
