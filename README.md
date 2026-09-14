<div align="center">

# Study Platform

### AI-powered learning — from any content, in any subject

[![.NET](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17_+_pgvector-4169E1?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

Upload documents in 236 file types, videos (paste a link from YouTube, Bilibili, Vimeo and 8 more sites — auto-detected — or upload your own), podcasts (any episode link, RSS feed, or MP3), and web articles — AI generates summaries, flashcards, quizzes, glossaries, and mind maps. Master any topic with spaced repetition, one-button daily smart sessions, an exam planner with AI mock exams and cram sheets, and a hands-free voice tutor.

---

![Study Platform demo](demos/StudyPlatformDemo.gif)

---

## Features

|     | Category                | What you get                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 📄  | **Content Sources**     | 236 document file types (PDF, Office, OpenDocument, iWork, eBooks, email, notebooks, subtitles, code — scans and images get AI OCR), video from 11 auto-detected sites (YouTube, Bilibili, etc.) or your own uploads, audio, web articles, and podcasts. Re-adding the same file or link is caught by content hash |
| 🤖  | **AI Generation**       | Summaries, flashcards (basic / cloze / chart), adaptive quizzes, glossaries, mind maps, worked problems — each citing the source passage it came from, and flagged as stale when you replace the source                                                                                                            |
| 🎯 | **Study Tools** | Rich-text notes, chat with voice dictation and read-aloud replies, graded teach-back, photo problem capture, FSRS-4.5 spaced repetition with per-user scheduler settings, question bank |
| 🗓️  | **Today & Practice**    | Daily plan with goal budgeting, one-button **smart session** (due reviews + mistake redos + weak concepts, interleaved), Practice / Exam mode with a timed runner                                                                                                                                                  |
| 🎓  | **Exam Prep**           | Exam planner with countdown and day-by-day schedule, AI cram sheets built from your weak spots, timed AI mock exams, mistakes notebook                                                                                                                                                                             |
| 📊 | **Insights** | Time-on-task and accuracy analytics, per-course mastery, knowledge-gap detection, AI recommendations, reinforcement modules for weak spots, AI usage and estimated cost |
| 🔎  | **Search**              | Semantic search across documents, videos, notes, flashcards and glossary — finds related concepts even when the words differ — plus ask-your-library AI answers with clickable citations                                                                                                                           |
| 🏷️ | **Organize** | Tags and collections on anything in your library |
| 🔊 | **Extras** | PDF annotations, text-to-speech, public share links, offline PWA (flashcards & glossary cached with background sync), due-card push reminders |
| 🔄 | **Import / Export** | Anki import & export, Notion / Markdown ZIP import, Markdown notes, quiz CSV / GIFT / QTI export, ICS calendar feed, web-clipper bookmarklet |
| 👥 | **Study Groups** | Invite-code groups with shared courses and real-time chat |
| 🔐 | **Account** | Email + OTP, Google / GitHub OAuth, full data export, and grace-period account deletion |
| 📱  | **Mobile App**          | React Native (Expo) app in [`rn/`](rn/README.md) at full web-feature parity, plus biometric lock, camera scan-to-summarize, offline review and push reminders                                                                                                                                                      |

**AI Providers** — Gemini · OpenAI · Claude · Grok · DeepSeek · Kimi · Doubao · Qwen · Wenxin Yiyan (multi-provider routing, switchable from settings)

---

## Tech Stack

**Backend** — .NET 10 · ASP.NET Core · EF Core 9 · MediatR · FluentValidation · SignalR · PostgreSQL · Redis · Amazon S3 · yt-dlp · ffmpeg · Whisper.net · MailKit · JWT

**Frontend** — React 19 · TypeScript 5.8 · Vite 6 · TailwindCSS 4 · React Router 7 · Tiptap · Markmap · Service Worker + idb-keyval (offline PWA)

**Mobile** — React Native 0.86 · Expo SDK 57 · expo-router · SignalR · WebView-hosted pdf.js / KaTeX / markmap (see [`rn/README.md`](rn/README.md))

**Shared** — `packages/core` (`@study/core`): platform-agnostic API services, SSE stream reader, and DTOs consumed by `web/` and `rn/`


**Architecture** — Clean Architecture · CQRS · Repository + Unit of Work · SSE streaming

---

## Local Setup

**Prerequisites** — .NET SDK 10 · Node.js 18+ · PostgreSQL 17 with [pgvector](https://github.com/pgvector/pgvector) (migrations create the `vector` extension — stock Postgres won't migrate) · Redis 7+ · ffmpeg · AWS CLI
**Required services** — Google Gemini API key, Google & GitHub OAuth apps, SMTP/SES email, S3 or MinIO storage (other AI providers optional)

```bash
# 1. Clone
git clone https://github.com/your-username/Study_Platform.git
cd Study_Platform

# 2. Create database
psql postgres -c "CREATE USER studyplatform WITH PASSWORD 'yourpassword';"
psql postgres -c "CREATE DATABASE studyplatform OWNER studyplatform;"

# 3. Start local services (MinIO console: http://localhost:9001, minioadmin / minioadmin123)
docker compose up -d redis minio minio-init

# 4. Configure server/StudyPlatform.API/appsettings.Development.json (see below)

# 5. Migrate & run backend
cd server
dotnet ef database update --project StudyPlatform.Infrastructure --startup-project StudyPlatform.API
dotnet run --project StudyPlatform.API     # → http://localhost:5001

# 6. Run frontend
cd web && npm install && npm run dev       # → http://localhost:3000

# 7. (Optional) Run the mobile app — see rn/README.md for env setup
cd rn && npm install && npx expo start
```

---

## Configuration

**`server/StudyPlatform.API/appsettings.Development.json`**

```jsonc
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=studyplatform;Username=studyplatform;Password=yourpassword",
  },
  "Redis": { "Enabled": false, "ConnectionString": "localhost:6379" }, // optional; off by default
  "JwtSettings": {
    "SecretKey": "your-32-char-secret",
    "AccessTokenExpiryMinutes": 15,
    "RefreshTokenExpiryDays": 7,
  },
  "EmailSettings": {
    "Provider": "Ses",
    "FromEmail": "you@gmail.com",
    "SesRegion": "ap-southeast-2",
  }, // or SMTP fallback
  "S3": {
    "BucketName": "documents-dev",
    "ServiceUrl": "http://localhost:9000", // local MinIO
    "PublicServiceUrl": "http://localhost:9000",
    "ForcePathStyle": true,
    "AccessKey": "minioadmin",
    "SecretKey": "minioadmin123",
  },
  "GoogleOAuth": { "ClientId": "xxxx.apps.googleusercontent.com", "ClientSecret": "GOCSPX-..." },
  "GitHubOAuth": { "ClientId": "Ov23lic...", "ClientSecret": "..." },
  "Cors": { "AllowedOrigins": ["http://localhost:3000", "http://localhost:3001"] },
  "AppLimits": { "DocumentUploadLimit": -1 }, // -1 = unlimited; hosted default 10
  // Optional — browser push reminders. Keys: npx web-push generate-vapid-keys
  "Vapid": { "PublicKey": "", "PrivateKey": "", "Subject": "mailto:you@example.com" },
  // Optional — AI metering. 0 = unlimited; pricing is per-million tokens, keyed by
  // model-name prefix (longest match wins). Unpriced models log tokens at a $0 estimate.
  "AiUsage": {
    "DailyTokenLimit": 0,
    "Pricing": { "gemini-2.5-flash": { "InputPerMillion": 0.30, "OutputPerMillion": 2.50 } },
  },
}
```

**`web/.env.local`** (and **`admin/.env.local`** with just `VITE_API_URL`)

```bash
VITE_API_URL=http://localhost:5001
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
VITE_GITHUB_CLIENT_ID=Ov23lic...
```

---

## Web Clipper

Clip any web page into your library as a cleaned-up Markdown article: drag the bookmarklet from **Settings → Export → Web Clipper bookmarklet** to your bookmarks bar — no install needed.

---

## Deployment

### Docker (self-hosted)

Bundles PostgreSQL and MinIO — no external database or storage account needed. Redis is optional and
not started by default (`docker compose up -d redis` plus `REDIS_ENABLED=true` to use it); the cache
falls through to the Postgres `CacheEntries` tier without it.

```bash
cp .env.example .env          # fill in all values
docker compose up --build -d
docker compose exec api dotnet ef database update \
  --project StudyPlatform.Infrastructure --startup-project StudyPlatform.API
```

Web `:3000` · Admin `:4200` · API + Swagger `:5001` · MinIO console `:9001`

> `VITE_*` variables are baked in at build time — rebuild frontend images after changing them. MinIO credentials and bucket come from `.env` (`MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` / `S3_BUCKET_NAME`); `S3_PUBLIC_SERVICE_URL` must be reachable from the host browser.

### AWS (ECS Fargate + Supabase)

`./deploy.sh` provisions ECS **Fargate** behind an ALB, S3 buckets, and static `web` / `admin`
frontends, and points the API at an external managed PostgreSQL — **Supabase**. No RDS instance and no
ElastiCache cluster are created. Export `DATABASE_CONNECTION_STRING`, `JWT_SECRET`,
`GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`, `SMTP_USER`, and `SMTP_PASSWORD` before running
it.

The older topology is still available: `DB_PROVIDER=rds` provisions RDS, `ECS_LAUNCH_TYPE=EC2` runs
ECS on a `t3.micro`, and `REDIS_ENABLED=true` provisions ElastiCache.

**[DEPLOYMENT.md](DEPLOYMENT.md)** has the full runbook — Supabase extension setup (`vector`,
`pg_trgm`), which of Supabase's three connection strings to use, closing Supabase's auto-generated
Data API, connection pooling, migrations, and the ECS environment variables.

### Scaling out

Redis is off by default and nothing requires it, so a single replica is the default shape. To run
several, set `Redis__Enabled=true` with a Redis to point at: SignalR picks up a Redis backplane
whenever Redis is configured and answers a startup ping, and degrades to instance-local delivery if
Redis dies later. Set `Api:RequireScaleOutBackplane=true` so a missing backplane fails startup instead of silently half-delivering hub messages. AI generation jobs stay pinned to the replica that accepted them (their provider credentials never touch the database).

### Video transcripts (production)

Online videos use native captions when available, then fall back to yt-dlp + Whisper; uploads go straight to ffmpeg + Whisper. YouTube may block cloud IPs — set `YOUTUBE_PROXY_URL` (SOCKS/HTTP proxy) and optionally `YOUTUBE_COOKIES_B64="$(base64 < cookies.txt | tr -d '\n')"` before running `./deploy-backend.sh`.

---

## License

[MIT](LICENSE)
