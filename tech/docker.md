# Docker

## Files

| Path | Purpose |
| --- | --- |
| `docker-compose.yml` | Local/self-host stack |
| `server/Dockerfile` | API image |
| `web/Dockerfile` | Main web image |
| `admin/Dockerfile` | Admin image |
| `web/nginx.conf` / `admin/nginx.conf` | Static frontend hosting |
| `web/docker-entrypoint.sh` / `admin/docker-entrypoint.sh` | Runtime frontend env injection |

## Services

The compose stack includes the API, web app, admin app, PostgreSQL, and Redis. The API still applies EF migrations at startup.

## API Startup in Container

The API container applies EF Core migrations automatically on startup. No manual migration step is needed for normal deployments:

```csharp
// Program.cs — run on every container start
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}
```

## Runtime ENV Injection

Vite variables are baked in at `npm run build`. The `docker-entrypoint.sh` scripts re-inject runtime configuration into the built JS bundles so the same image can be deployed to different environments without rebuilding:

```bash
# web/docker-entrypoint.sh (pattern)
# Replace placeholder values in the built JS with actual env vars
find /usr/share/nginx/html/assets -name '*.js' -exec \
  sed -i "s|VITE_API_URL_PLACEHOLDER|${VITE_API_URL}|g" {} \;
nginx -g 'daemon off;'
```

## Important Note

Vite variables are build-time by default. The Docker entrypoint scripts are present to support runtime configuration injection for deployed static frontends.
