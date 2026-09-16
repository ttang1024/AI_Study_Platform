# Production deployment — S3 + CloudFront · ECS Fargate · Supabase

```
        Browser
           │ HTTPS
        CloudFront → S3 (static web / admin builds)
           │ HTTPS   VITE_API_URL, baked in at build time → the API's CloudFront / ALB
        AWS ECS Fargate — ASP.NET Core 10 API
           │ PostgreSQL over TLS
        Supabase PostgreSQL + pgvector
```

* **Redis is off.** Nothing in the API requires it — no ElastiCache, no Redis container, no connection string.
* **The database connection exists only on the API.** The browser and the static frontends never see a
  Postgres credential, and need no Supabase key of any kind.

---

## 1. Supabase setup

### 1.1 Enable `vector` and `pg_trgm`

The schema needs `vector` (semantic search / RAG) and `pg_trgm` (trigram indexes behind keyword
search). Enable both **before the first deploy** — Dashboard → Database → Extensions. The EF migration
also issues `CREATE EXTENSION IF NOT EXISTS`, so doing it by hand only keeps a first migration from
failing on a permissions surprise.

Which schema they land in does not matter for a fresh database: EF emits the type unqualified
(`vector(1536)`), which Supabase's `search_path` resolves whether the extension sits in `extensions`
(Dashboard default) or `public`. Verified both ways — 45 tables, `vector(1536)`, HNSW index. It *must*
be in `public` only when restoring a `pg_dump` (§4b).

```sql
select extname, extnamespace::regnamespace from pg_extension where extname in ('vector','pg_trgm');
```

### 1.2 Pick the right connection string

Supabase offers three and they are not interchangeable:

| Mode | Host / port | Use it? |
| --- | --- | --- |
| **Session pooler** | `aws-0-<region>.pooler.supabase.com:5432` | **Yes — default.** IPv4-reachable from an ordinary VPC, and each connection gets a dedicated session, so prepared statements, `SET` and advisory locks all behave. |
| Direct | `db.<project-ref>.supabase.co:5432` | Only with IPv6 egress (or the IPv4 add-on). Otherwise the ENI cannot reach it. |
| Transaction pooler | `…pooler.supabase.com:6543` | **No.** Multiplexes per statement: no prepared statements, no session state. A long-lived EF Core process with its own Npgsql pool gains nothing and breaks on it. |

Copy the **.NET** flavour from Dashboard → Project Settings → Database → Connection string, and keep
`SSL Mode=Require` on it.

### 1.3 Close the Supabase Data API

Supabase auto-generates a public PostgREST API over the `public` schema, and its default privileges
grant `anon`/`authenticated` access to tables created there — which is every table EF migrates. RLS is
**not** on by default for tables created outside the dashboard, so they can be read with the project's
anon key even though your frontend never uses it.

This app authorizes per user in the API layer and never uses PostgREST, so turn the door off:

> **Project Settings → API → Data API → remove `public` from "Exposed schemas"** (or disable the Data
> API entirely).

Confirm from outside AWS that `https://<project-ref>.supabase.co/rest/v1/Users?select=*` with the anon
key returns an error rather than rows.

---

## 2. Backend configuration

Everything is read from the environment; the image contains no credentials.

### 2.1 Required ECS task environment variables

| Variable | Value |
| --- | --- |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ConnectionStrings__DefaultConnection` | the Supabase session-pooler connection string |
| `JwtSettings__SecretKey` | 64-char hex secret |
| `AWS__Region` / `S3__BucketName` | region and documents bucket |
| `Web__PublicOrigin` | web frontend's public origin, e.g. `https://example.com`. The API reads `index.html` back from it to render `/share/{token}` previews and builds the share URLs from it. Unset → share links fall back to the generic landing-page card. |
| `Cors__AllowedOrigins__0` | web frontend's public origin |
| `Cors__AllowedOrigins__1`, `…__2` | any further origins (www, admin) |
| `Embeddings__ApiKey` | embeddings provider key. Optional, but without it semantic search / RAG indexing does not run. |

### 2.2 Optional

| Variable | Default | Notes |
| --- | --- | --- |
| `Redis__Enabled` | `false` | Already the default in `appsettings.json`; documentation more than configuration. |
| `Database__MigrateOnStartup` | `true` | See §4. |
| `Database__MaxPoolSize` | `20` | Npgsql connections per task. See §3. |
| `Database__CommandTimeoutSeconds` | `60` | |
| `Database__ConnectTimeoutSeconds` | `15` | |
| `Api__RequireScaleOutBackplane` | `false` | Fails startup if SignalR has no Redis backplane. Only meaningful with >1 task **and** Redis on. |

### 2.3 Secrets

`ConnectionStrings__DefaultConnection`, `JwtSettings__SecretKey`, `GoogleOAuth__ClientSecret`,
`GitHubOAuth__ClientSecret`, `EmailSettings__SmtpPassword` and `Embeddings__ApiKey` are credentials.
Put them in Secrets Manager or SSM and reference them from the task definition's `secrets` block, not
`environment`, so they stay out of `aws ecs describe-task-definition` output.

---

## 3. Connection pooling and TLS

Npgsql pools inside each process; Supabase pools in front of Postgres. Npgsql's default is **100
connections per process**, sized for a database you own — against a shared managed instance two or
three tasks at that setting can consume the whole connection allowance and every later connection
fails with *"remaining connection slots are reserved"*. The default here is **20**
(`Database__MaxPoolSize`), ample for this service plus its background workers.

Anything written in the connection string wins: specify `Maximum Pool Size`, `Timeout`,
`Command Timeout` or `SSL Mode` there and the application will not touch it.

TLS is mandatory — the connection string gets `SSL Mode=Require` if it specifies no mode, and nothing
disables certificate validation (Npgsql 9 ignores `Trust Server Certificate` entirely). To also
*validate* the certificate, download the project CA (Dashboard → Database → SSL Configuration), make
it available to the container, and set `SSL Mode=VerifyFull;Root Certificate=/app/certs/supabase-ca.crt`
— that checks the chain and the hostname, and is a connection-string change only.

---

## 4. Migrations

`db.Database.Migrate()` runs at startup by default — it applies pending migrations and never drops or
recreates anything. That is fine for a single task.

Turn it off once you run more than one task (concurrent `Migrate()` calls contend on the
migration-history lock) or once a migration outlasts the load balancer's health-check grace period.
Set `Database__MigrateOnStartup=false` in the task definition and apply migrations yourself before
rolling the service:

```bash
cd server
ConnectionStrings__DefaultConnection='<supabase connection string>' \
dotnet ef database update --project StudyPlatform.Infrastructure --startup-project StudyPlatform.API
```

With the flag off, a task starting against an un-migrated database logs a warning naming every pending
migration instead of silently serving a stale schema.

---

## 4b. Migrating an existing database into Supabase

`scripts/migrate-db.sh` copies a populated PostgreSQL database into the Supabase project. The source is
only ever read.

```bash
export SOURCE_CONNECTION_STRING='Host=...;Port=5432;Database=...;Username=...;Password=...'
# Target defaults to DATABASE_CONNECTION_STRING.
./scripts/migrate-db.sh preflight   # read-only; reports what would happen
./scripts/migrate-db.sh run         # dump → restore → verify
./scripts/migrate-db.sh verify      # re-compare row counts at any time
```

`run` refuses a non-empty target unless `MIGRATE_FORCE=1`, restores inside `--single-transaction` (a
failure leaves the target byte-for-byte unchanged, not half-migrated), and finishes by comparing exact
per-table row counts. Two things it handles that a hand-rolled `pg_dump | psql` gets wrong:

* **`vector` must live in `public` on the target.** `pg_dump` schema-qualifies every type as
  `public.vector(1536)`, so a restore against Supabase's default `extensions` schema fails part-way.
  Preflight refuses up front and prints the fix:
  ```sql
  ALTER EXTENSION vector  SET SCHEMA public;
  ALTER EXTENSION pg_trgm SET SCHEMA public;
  ```
* **`CREATE SCHEMA public` is in the dump and always collides.** Inside `--single-transaction` that one
  error rolls back everything, so the script filters that entry (and its `COMMENT`) out of the
  restore's table of contents.

After a successful run the target has the full schema, the `vector(1536)` column, the HNSW and trigram
indexes, every foreign key, and an `__EFMigrationsHistory` that leaves `dotnet ef database update` a
no-op.

---

## 5. Deploying

```bash
export DATABASE_CONNECTION_STRING='Host=aws-0-<region>.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.<ref>;Password=<pw>;SSL Mode=Require'
export JWT_SECRET=...
export GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
export GITHUB_CLIENT_ID=... GITHUB_CLIENT_SECRET=...
export SMTP_USER=... SMTP_PASSWORD=...
export EMBEDDINGS_API_KEY=...   # optional; enables semantic search indexing

./deploy.sh              # everything
./deploy-backend.sh      # API only
```

Defaults: `ECS_CPU_ARCHITECTURE=X86_64`, `REDIS_ENABLED=false`, `PUBLIC_DOMAIN` unset. The database is
always the external managed PostgreSQL named by `DATABASE_CONNECTION_STRING` — nothing database-shaped
is provisioned in AWS. Compute is always ECS Fargate and the image is always built with local Docker,
so the daemon must be running.

**Put `AWS_REGION` in the same region as the Supabase project.** Every database call is a network round
trip; pairing regions across continents adds 150–250 ms to each, and one API request makes several.

**Image architecture.** `ECS_CPU_ARCHITECTURE` sets both `docker build --platform` and the task's
`runtimePlatform`, because they must agree. On an Apple-silicon Mac an unpinned build produces
`linux/arm64` while ECS defaults Fargate to `X86_64`, and the task fails to start with *"image manifest
does not contain a descriptor matching platform"*. `ARM64` (Graviton) is cheaper and builds natively on
such a Mac — confirm the Whisper.net native runtime works there before switching.

**Custom domains are opt-in.** `PUBLIC_DOMAIN=example.com` yields `https://example.com`, `https://www.…`,
`https://api.…` and `https://admin.…`. Leave it unset for a first deploy: with an API origin set the
script skips creating the API's CloudFront distribution and bakes that hostname into the frontend
build, so if DNS and the ACM certificate are not yet in this account the deploy reports success and the
site is entirely broken. Deploy first, verify on the CloudFront/ALB hostnames AWS hands out, then set
`PUBLIC_DOMAIN` and redeploy.

Fargate specifics the script handles: `awsvpc` networking with a task ENI, `assignPublicIp=ENABLED` so
the task can reach ECR and Supabase without a NAT gateway, an `ip`-type target group, and a CPU/memory
pair Fargate accepts (1024 / 2048 by default).

### Frontend

`deploy.sh` builds `web/` and `admin/` with Vite, syncs each `dist/` to its own S3 website bucket, and
serves them through a CloudFront distribution (`<app>-web-cloudfront`, `<app>-admin-cloudfront`).
`WEB_PUBLIC_ORIGIN` / `ADMIN_PUBLIC_ORIGIN` override the origins if you front them yourself.

The API origin is **baked in at build time** as `VITE_API_URL` (`web/src/utils/env.ts` reads
`NEXT_PUBLIC_API_URL` first and falls back to it). Baked-in means a changed API origin needs a frontend
rebuild and re-sync — `./deploy.sh` with `DEPLOY_WEB_ONLY=1` does that without touching ECS.

No database credential, Supabase URL or Supabase key belongs in any frontend variable; the frontend
talks only to the API.

#### `/share/*` is served by the API, not by S3

Share pages are the one route the web distribution does not serve from its bucket. `deploy.sh`
(`ensure_share_preview_behavior`) adds a `/share/*` cache behavior pointing at the API's load balancer,
because a crawler cannot run the JavaScript that fetches the shared content — served the plain
`index.html` it would build the same landing-page card for every shared link. The API returns that same
shell with this share's title, summary snippet and contents already in the meta tags, so the browser
still boots the identical SPA build. Two consequences:

- The API must reach `Web__PublicOrigin` over HTTPS; that is where it reads the shell from. It caches
  it for 5 minutes and keeps a last-known-good copy for 24 hours, so a blip at the web origin does not
  take share pages down.
- Search engines are still kept off `/share/` by `robots.txt`; the explicit `Allow` groups name only
  link-preview crawlers (Twitterbot, facebookexternalhit, Slackbot, …).

---

## 6. Redis

**How it is off.** `Redis:Enabled` defaults to `false`, and when false the process never constructs a
`ConnectionMultiplexer`, never reads a Redis connection string, and opens no socket:

* **Cache** — `IDistributedCache` resolves to `NoOpDistributedCache`, and the two-tier `IAppCache`
  (`DistributedAppCache`) writes through to the Postgres `CacheEntries` table, so cached values still
  hit, expire and invalidate — shared across tasks, which an in-process memory cache would not be.
* **SignalR** — no backplane; the in-memory hub lifetime manager handles a single task correctly.
* **Rate limiting** — already in-process (`AddInMemoryRateLimiting`), unaffected.
* **Health** — `/health` (liveness) checks no dependencies. `/health/ready` reports the cache check as
  **Healthy** with *"No distributed cache configured"*, because a dependency nobody asked for is not a
  degradation.

A stale `Redis__ConnectionString` in the environment is ignored entirely while `Redis__Enabled` is false.

**How to turn it on later.**

```
Redis__Enabled=true
Redis__ConnectionString=<host>:<port>,ssl=true,password=<password>
Redis__InstanceName=StudyPlatform:          # optional key/channel prefix
```

That is the whole change — the cache switches to Redis and SignalR picks up the backplane, provided
Redis answers a startup ping. If it does not the app still starts: the cache falls back and the
backplane is skipped with a warning on stderr. Set `Api__RequireScaleOutBackplane=true` to make that a
startup failure instead, which is what you want with several replicas.

`deploy.sh` provisions no Redis — bring your own (ElastiCache, Upstash, anything that speaks the
protocol) and pass `REDIS_ENABLED=true` and `REDIS_CONNECTION_STRING=...` (optionally
`REDIS_INSTANCE_NAME`), which become the `Redis__*` settings above. An ElastiCache cluster must sit in
the same VPC with the ECS task's security group allowed on its port.

**What still depends on Redis:** only multi-replica real-time messaging. Without a backplane, group-chat
hub messages reach only clients connected to the task that produced them. Everything else — caching,
rate limiting, sessions, jobs — works identically with Redis off, and a single task has no such limit.

---

## 7. Known limitations of this topology

* **AI generation jobs are replica-affine.** A job's provider credentials live only in the accepting
  task's in-memory queue, never in the row, so no other task can run it. `StaleAiJobReaper` fails
  orphans after 30 minutes. Draining a task fails its in-flight jobs; the user retries.
* **`EmbeddingBackfillWorker` duplicates work** if every task runs it. Keep `ECS_DESIRED_COUNT=1`
  unless you gate that worker.
* **Data Protection keys are per-task and ephemeral** on Fargate (no persistent volume). JWTs are
  HMAC-signed from `JwtSettings__SecretKey` and unaffected, but anything that starts using
  `IDataProtector` will need a shared key ring (S3 or Secrets Manager).
* **`appsettings.json` held live credentials that were being baked into the image.** It is gitignored
  (so not in git history — verified), but the Dockerfile's `COPY . .` had no `.dockerignore` and copied
  the developer's file — SMTP app password, Google/GitHub OAuth secrets, a Gemini embeddings key, a JWT
  signing key — into every image pushed to ECR. `server/.dockerignore` now excludes it and
  `appsettings.Production.json` carries the non-secret settings it supplied. **Rotate those credentials**
  if any previously built image is still in ECR; they are readable in its layers.
* **Whisper and yt-dlp run in-process** in the API container. 2 GB is the working default; transcript
  jobs on long videos are the memory ceiling to watch.
