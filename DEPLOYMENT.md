# Production deployment — Vercel · ECS Fargate · Supabase

```
        Browser
           │ HTTPS
        Vercel (frontend)
           │ HTTPS   NEXT_PUBLIC_API_URL → the ALB / CloudFront in front of the API
        AWS ECS Fargate — ASP.NET Core 10 API
           │ PostgreSQL over TLS
        Supabase PostgreSQL + pgvector
```

Two things are true of this topology and worth stating plainly:

* **Redis is off.** Nothing in the API requires it. No ElastiCache cluster, no Redis container, no
  Redis connection string.
* **The database connection exists only on the API.** The browser and the Vercel frontend never see a
  Postgres credential, and the frontend needs no Supabase key of any kind.

---

## 1. Supabase setup

### 1.1 Enable the two PostgreSQL extensions

The schema needs `vector` (semantic search / RAG) and `pg_trgm` (trigram indexes behind keyword
search). Enable both **before the first deploy** — Dashboard → Database → Extensions → search for each
and toggle it on. Supabase installs them into the `extensions` schema, which is on the database's
default `search_path`, so `vector(1536)` columns and the `<=>` distance operator resolve normally.

The EF Core migration also issues `CREATE EXTENSION IF NOT EXISTS`, so once they are enabled that
step is a no-op. Enabling them by hand first is what keeps a first migration from failing on a
permissions surprise.

**Which schema they land in does not matter for a fresh database.** EF emits the column type
unqualified (`vector(1536)`), so Supabase's `search_path` resolves it whether the extension sits in
`extensions` (the Dashboard's default) or in `public` (where an unqualified `CREATE EXTENSION` puts
it). Verified both ways: 45 tables, `vector(1536)`, and the HNSW index in each case. The extension
*must* be in `public` only when restoring a `pg_dump` — see §4b for why.

Verify:

```sql
select extname, extnamespace::regnamespace from pg_extension where extname in ('vector','pg_trgm');
```

### 1.2 Pick the right connection string

Supabase offers three, and they are not interchangeable for this app:

| Mode | Host / port | Use it? |
| --- | --- | --- |
| **Session pooler** | `aws-0-<region>.pooler.supabase.com:5432` | **Yes — default.** IPv4-reachable from an ordinary VPC, and each client connection gets a dedicated Postgres session, so prepared statements, `SET`, and advisory locks all behave. |
| Direct | `db.<project-ref>.supabase.co:5432` | Only if your tasks have IPv6 egress (or you bought the IPv4 add-on). Otherwise the ENI cannot reach it. |
| Transaction pooler | `…pooler.supabase.com:6543` | **No.** It multiplexes sessions per statement: no prepared statements, no session state. A long-lived EF Core process with its own Npgsql pool gains nothing from it and breaks on it. |

An ECS Fargate task is a long-lived process that already pools connections in-process — it wants a
session, not a statement multiplexer.

Copy the **.NET** flavour of the string from Dashboard → Project Settings → Database → Connection
string, and keep `SSL Mode=Require` on it.

### 1.3 Close the Supabase Data API

This is the one Supabase-specific thing that has no equivalent in a plain RDS deployment, and it
matters. Supabase auto-generates a public REST API (PostgREST) over the `public` schema, and its
default privileges grant the `anon` and `authenticated` roles access to tables created there — which
is every table EF Core migrates. Row Level Security is **not** on by default for tables created
outside the dashboard, so those tables can be readable with the project's (publishable) anon key even
though your own frontend never uses it.

The app authorizes per user in the API layer and does not use PostgREST at all, so turn the door off:

> **Project Settings → API → Data API → remove `public` from "Exposed schemas"** (or disable the Data
> API entirely, where your project offers that).

Then confirm from outside AWS that `https://<project-ref>.supabase.co/rest/v1/Users?select=*` with the
anon key returns an error rather than rows.

---

## 2. Backend configuration

Everything below is read from the environment. The image contains no credentials.

### 2.1 Required ECS task environment variables

| Variable | Value |
| --- | --- |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ConnectionStrings__DefaultConnection` | the Supabase session-pooler connection string |
| `JwtSettings__SecretKey` | 64-char hex secret |
| `AWS__Region` / `S3__BucketName` | region and documents bucket |
| `Cors__AllowedOrigins__0` | your Vercel production origin, e.g. `https://app.example.com` |
| `Cors__AllowedOrigins__1`, `…__2` | any further origins (www, admin) |
| `Embeddings__ApiKey` | embeddings provider key. Optional, but without it semantic search / RAG indexing does not run — it used to arrive baked into the image (see §7) and is now an environment variable. |

### 2.2 Redis — explicitly off

| Variable | Value |
| --- | --- |
| `Redis__Enabled` | `false` |

`false` is also the built-in default in `appsettings.json` and `appsettings.Production.json`, so the
variable is documentation more than configuration. No Redis connection string is needed or read.

### 2.3 Optional

| Variable | Default | Notes |
| --- | --- | --- |
| `Database__MigrateOnStartup` | `true` | See §4. |
| `Database__MaxPoolSize` | `20` | Npgsql connections per task. See §3. |
| `Database__CommandTimeoutSeconds` | `60` | |
| `Database__ConnectTimeoutSeconds` | `15` | |
| `Api__RequireScaleOutBackplane` | `false` | Fails startup if SignalR has no Redis backplane. Only meaningful with more than one task **and** Redis on. |

### 2.4 Secrets

`ConnectionStrings__DefaultConnection`, `JwtSettings__SecretKey`, `GoogleOAuth__ClientSecret`,
`GitHubOAuth__ClientSecret`, `EmailSettings__SmtpPassword`, and `Embeddings__ApiKey` are credentials. Put them in AWS
Secrets Manager or SSM Parameter Store and reference them from the task definition's `secrets` block
rather than `environment`, so they do not appear in `aws ecs describe-task-definition` output.

---

## 3. Connection pooling

Npgsql pools connections inside each process; Supabase pools them in front of Postgres. Both are
already in play — nothing new was added.

What did change is the size. Npgsql's default is **100 connections per process**, which is sized for a
database you own. Against a shared managed instance, two or three Fargate tasks at that setting can
consume the project's entire connection allowance and every later connection fails with *"remaining
connection slots are reserved"*. The default is now **20** (`Database__MaxPoolSize`), which is ample
for this service's request load plus its background workers.

Anything you write in the connection string wins: specify `Maximum Pool Size`, `Timeout`,
`Command Timeout`, or `SSL Mode` there and the application will not touch it.

### TLS

The connection string gets `SSL Mode=Require` if it does not already specify a mode — TLS is
mandatory, and nothing in the code disables certificate validation (Npgsql 9 ignores
`Trust Server Certificate` entirely; it is a no-op).

To additionally *validate* Supabase's certificate, download the project CA certificate (Dashboard →
Database → SSL Configuration), make it available to the container, and set:

```
SSL Mode=VerifyFull;Root Certificate=/app/certs/supabase-ca.crt
```

`VerifyFull` verifies the chain and the hostname. It is strictly better than the default and is a
connection-string change only.

---

## 4. Migrations

`db.Database.Migrate()` still runs at startup by default — it applies pending migrations and never
drops or recreates anything. That is fine for a single task.

Turn it off once you run more than one task at a time (concurrent `Migrate()` calls contend on the
migration-history lock) or once a migration is slow enough to eat the load balancer's health-check
grace period:

```bash
# in the task definition
Database__MigrateOnStartup=false
```

and apply migrations yourself before rolling the service:

```bash
cd server
ConnectionStrings__DefaultConnection='<supabase connection string>' \
dotnet ef database update \
  --project StudyPlatform.Infrastructure \
  --startup-project StudyPlatform.API
```

With the flag off, a task that starts against an un-migrated database logs a warning naming every
pending migration instead of silently serving a stale schema.

---

## 4b. Migrating an existing database into Supabase

`scripts/migrate-db.sh` copies a populated database (the previous RDS instance) into the Supabase
project. The source is only ever read.

```bash
# Source defaults to the RDS string built from DB_HOST/DB_PASS in .env_variables;
# target defaults to DATABASE_CONNECTION_STRING.
./scripts/migrate-db.sh preflight   # read-only; reports what would happen
./scripts/migrate-db.sh run         # dump → restore → verify
./scripts/migrate-db.sh verify      # re-compare row counts at any time
```

`run` refuses a non-empty target unless `MIGRATE_FORCE=1`, restores inside `--single-transaction` (a
failure leaves the target byte-for-byte unchanged, not half-migrated), and finishes by comparing
**exact per-table row counts** between source and target.

Two things it handles that a hand-rolled `pg_dump | psql` gets wrong:

* **`vector` must live in `public` on the target.** `pg_dump` emits `SELECT set_config('search_path','')`
  and schema-qualifies every type as `public.vector(1536)`. Supabase installs extensions into
  `extensions` by default, so the restore fails part-way through. Preflight refuses up front and
  prints the fix:
  ```sql
  ALTER EXTENSION vector  SET SCHEMA public;
  ALTER EXTENSION pg_trgm SET SCHEMA public;
  ```
  (This matches what the app's own migration produces — `CREATE EXTENSION IF NOT EXISTS vector` with
  no schema resolves to `public`.)
* **`CREATE SCHEMA public` is in the dump and always collides.** Inside `--single-transaction` that one
  error rolls back everything. The script filters that entry (and its `COMMENT`) out of the restore's
  table of contents instead of abandoning the transaction.

After a successful run the target has the full schema, the `vector(1536)` column, the HNSW index, the
trigram indexes, every foreign key, and an `__EFMigrationsHistory` that leaves `dotnet ef database
update` a no-op.

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

Defaults: `DB_PROVIDER=supabase` (no RDS is created), `ECS_LAUNCH_TYPE=FARGATE`,
`ECS_CPU_ARCHITECTURE=X86_64`, `REDIS_ENABLED=false` (no ElastiCache is created), and
`PUBLIC_DOMAIN` unset. The older topology is still reachable with `DB_PROVIDER=rds` and
`ECS_LAUNCH_TYPE=EC2`.

**Put `AWS_REGION` in the same region as the Supabase project.** Every database call is now a network
round trip; pairing regions across continents adds 150–250 ms to each one, and a single API request
makes several.

**Image architecture.** `ECS_CPU_ARCHITECTURE` sets both the `docker build --platform` and the task's
`runtimePlatform`, because they must agree. On an Apple-silicon Mac an unpinned `docker build`
produces `linux/arm64` while ECS defaults Fargate to `X86_64`, and the task then fails to start with
*"image manifest does not contain a descriptor matching platform"*. `ARM64` (Graviton) is cheaper and
builds natively on such a Mac — confirm the Whisper.net native runtime works there before switching.

**Custom domains are opt-in.** `PUBLIC_DOMAIN=example.com` yields `https://example.com`,
`https://www.…`, `https://api.…` and `https://admin.…`. Leave it unset for a first deploy: with an API
origin set the script skips creating the API's CloudFront distribution and bakes that hostname into
the frontend build, so if DNS and the ACM certificate are not yet in this account the deploy reports
success and the site is entirely broken. Deploy first, verify on the CloudFront/ALB hostnames AWS
hands out, then set `PUBLIC_DOMAIN` and redeploy once DNS and the certificate are in place.

Fargate specifics the script handles: `awsvpc` networking with a task ENI, `assignPublicIp=ENABLED`
so the task can pull from ECR and reach Supabase without a NAT gateway, an `ip`-type target group, and
a CPU/memory pair Fargate accepts (1024 / 2048 by default — Fargate rejects the EC2 path's 768 MB).
Switching an existing service between launch types recreates it, because a service's launch type is
immutable.

### Frontend

The frontend reads `NEXT_PUBLIC_API_URL` (falling back to `VITE_API_URL`). Set it in Vercel to the
API's public origin. No database credential, Supabase URL, or Supabase key belongs in any
`NEXT_PUBLIC_*` variable — the frontend talks only to the API.

---

## 6. Redis

### How it is off

`Redis:Enabled` defaults to `false`. When it is false the process never constructs a
`ConnectionMultiplexer`, never reads a Redis connection string, and opens no socket:

* **Cache** — `IDistributedCache` resolves to `NoOpDistributedCache`. `IAppCache`
  (`DistributedAppCache`) is two-tier and writes through to the Postgres `CacheEntries` table, so
  cached values still hit, still expire, and are still invalidated — shared across every task, which
  an in-process memory cache would not be.
* **SignalR** — no backplane; the in-memory hub lifetime manager handles a single task correctly.
* **Rate limiting** — was already in-process (`AddInMemoryRateLimiting`) and is unaffected.
* **Health** — `/health` (liveness) checks no dependencies at all. `/health/ready` reports the cache
  check as **Healthy** with *"No distributed cache configured"*, because a dependency nobody asked for
  is not a degradation.

A stale `Redis__ConnectionString` left in the environment is ignored entirely while `Redis__Enabled`
is false.

### How to turn it on later

```
Redis__Enabled=true
Redis__ConnectionString=<host>:<port>,ssl=true,password=<password>
Redis__InstanceName=StudyPlatform:          # optional key/channel prefix
```

That is the whole change — the cache switches to Redis and SignalR picks up the backplane, provided
Redis answers a startup ping. If it does not, the app still starts: the cache falls back and the
backplane is skipped with a warning on stderr. Set `Api__RequireScaleOutBackplane=true` to make a
missing backplane a startup failure instead, which is what you want when running several replicas.

`./deploy.sh` with `REDIS_ENABLED=true` will provision an ElastiCache cluster; if you would rather not
have one, point `REDIS_CONNECTION_STRING` at your own Redis and leave `REDIS_ENABLED` false for the
provisioning step while setting `Redis__Enabled=true` in the task definition.

### What still depends on Redis

Only **multi-replica real-time messaging**. Group-chat hub messages reach only the clients connected
to the task that produced them without a backplane. Everything else — caching, rate limiting,
sessions, jobs — works identically with Redis off. A single Fargate task has no such limitation.

---

## 7. Known limitations of this topology

* **AI generation jobs are replica-affine.** A job's provider credentials live only in the accepting
  task's in-memory queue, never in the row, so no other task can run it. `StaleAiJobReaper` fails
  orphans after 30 minutes. Draining a task therefore fails its in-flight jobs; the user retries.
* **`EmbeddingBackfillWorker` duplicates work** if every task runs it. Keep `ECS_DESIRED_COUNT=1`
  unless you gate that worker.
* **Data Protection keys are per-task and ephemeral** on Fargate (no persistent volume). JWTs are
  HMAC-signed from `JwtSettings__SecretKey` and unaffected, but anything that ever starts using
  `IDataProtector` will need a shared key ring (S3 or Secrets Manager).
* **`appsettings.json` held live credentials that were being baked into the image.** It is gitignored
  (so not in git history — verified), but the Dockerfile's `COPY . .` had no `.dockerignore` and
  copied the developer's file — SMTP app password, Google/GitHub OAuth secrets, a Gemini embeddings
  key, a JWT signing key — into every image pushed to ECR. `server/.dockerignore` now excludes it, and
  `appsettings.Production.json` carries the non-secret settings it used to supply. **Rotate those
  credentials** if any previously built image is still in ECR, since they are readable in its layers.
* **Whisper and yt-dlp run in-process** in the API container. 2 GB is the working default; transcript
  jobs on long videos are the memory ceiling to watch.
