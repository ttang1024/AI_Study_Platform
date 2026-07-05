# Kubernetes deployment

A Helm chart at `helm/study-platform/` that runs the full stack — `api`
(server/), `web` and `admin` (nginx-served Vite SPAs), plus in-cluster
`postgres`, `redis`, and `minio` — as a cloud-agnostic alternative to
`docker-compose.yml`. It works on any cluster: `kind`/`minikube` for local
dev, or a managed service like EKS/GKE for production.

No application code changes were needed: the chart reproduces the exact
env-var contract from `docker-compose.yml` (ASP.NET Core config keys via
`ConfigMap`/`Secret`), so `server/`, `web/`, and `admin/` run unmodified.

## Build and load images

The chart doesn't build images — build the three existing Dockerfiles and
push them somewhere your cluster can pull from (or load directly into a
local cluster):

```bash
docker build -t study-platform-api:latest ./server
docker build -t study-platform-web:latest ./web \
  --build-arg VITE_API_URL= \
  --build-arg VITE_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID \
  --build-arg VITE_GITHUB_CLIENT_ID=$GITHUB_CLIENT_ID
docker build -t study-platform-admin:latest ./admin \
  --build-arg VITE_API_URL=

# kind:
kind load docker-image study-platform-api:latest study-platform-web:latest study-platform-admin:latest
# minikube:
minikube image load study-platform-api:latest
```

For a remote cluster, tag and push to your registry instead, then set
`api.image.repository` / `.tag` (and the equivalents for `web`/`admin`) in
your values override.

`VITE_*` values are baked in at image build time (same constraint as
docker-compose) — rebuild the `web`/`admin` images after changing them.

## Local dev (kind/minikube)

```bash
helm install study-platform ./k8s/helm/study-platform \
  --set secrets.postgresPassword=devpassword \
  --set secrets.jwtSecretKey=$(openssl rand -hex 32)

kubectl port-forward svc/study-platform-web 3000:80
kubectl port-forward svc/study-platform-admin 4200:80
```

## Production

Copy `secrets.values.yaml` locally (gitignored — never commit it) with real
values for `secrets.*` in `values.yaml`, then:

```bash
helm upgrade --install study-platform ./k8s/helm/study-platform \
  -f k8s/helm/study-platform/values.yaml \
  -f k8s/helm/study-platform/values-production.yaml \
  -f secrets.values.yaml \
  --namespace study-platform --create-namespace
```

See `values-production.yaml` for ingress/TLS/storage-class/resource
overrides, and `values.yaml` for the full list of `secrets.*` keys
(Postgres password, JWT secret, SMTP, OAuth, MinIO/S3 credentials, optional
VAPID web-push keys and YouTube proxy/cookies).

For a secrets manager instead of chart-managed values, set
`secrets.existingSecretName` to a `Secret` you provision externally (Sealed
Secrets, External Secrets Operator, etc.) — see the comments in
`templates/secret-app.yaml` for the exact key names it must contain.

## Known constraint: single API replica

`AudioTranscriptionQueue` (Whisper jobs) and `DueReviewPushWorker` (push
reminders) run in-process inside the API and assume a single instance —
there's no SignalR backplane for multi-replica coordination. `api.replicaCount`
must stay at `1` until that's extracted (see `tech_doc/deployment.md`). `web`
and `admin` are stateless and scale freely.

## Relationship to `deploy.sh`

`deploy.sh`/`deploy-backend.sh`/`deploy-web.sh` at the repo root deploy to
AWS ECS + RDS + ElastiCache + CloudFront and are unaffected by this chart —
both deployment paths can coexist. To run this chart against managed AWS
services instead of in-cluster Postgres/Redis/MinIO, set `postgres.enabled`,
`redis.enabled`, and `minio.enabled` to `false` and point the derived
connection values in `templates/secret-app.yaml` at your RDS/ElastiCache/S3
endpoints (or supply them via `secrets.existingSecretName`).
