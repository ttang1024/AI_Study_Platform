<div align="center">

# Study Platform

### AI-powered learning — from any content, in any subject

**[toto-study.com](https://toto-study.com)**

[![.NET](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17_+_pgvector-4169E1?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

Upload a document, paste a video or podcast link, clip a web article — AI turns it into summaries,
flashcards, quizzes, glossaries and mind maps, and an FSRS-4.5 scheduler drives it into memory.

![Study Platform demo](demos/StudyPlatformDemo.gif)

---

## Features

|     | Category            | What you get                                                                                                                                       |
| --- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📄  | **Content**         | 234 document types (PDF, Office, eBooks, notebooks, code — scans get AI OCR), video from 11 auto-detected sites or your own uploads, audio, podcasts, web articles. Duplicates caught by content hash |
| 🤖  | **AI Generation**   | Summaries, flashcards, adaptive quizzes, glossaries, mind maps, worked problems — each citing its source passage, flagged stale when the source changes |
| 🎯  | **Study**           | FSRS-4.5 spaced repetition with per-user scheduler settings, rich-text notes, chat with voice dictation and read-aloud, graded teach-back, photo problem capture |
| 🗓️  | **Today & Exams**   | Daily plan, one-button **smart session** (due reviews + mistake redos + weak concepts), Practice/Exam mode, exam planner with AI mock exams and cram sheets, mistakes notebook |
| 📊  | **Insights**        | Time-on-task and accuracy analytics, per-course mastery, knowledge-gap detection, AI recommendations, AI usage and estimated cost                      |
| 🔎  | **Search**          | Semantic search across your whole library — finds related concepts when the words differ — plus ask-your-library answers with clickable citations       |
| 🔊  | **Extras**          | Tags and collections, PDF annotations, text-to-speech, share links, offline PWA, push reminders, invite-code study groups with real-time chat           |
| 🔄  | **Import/Export**   | Anki import & export, Markdown notes, quiz CSV / GIFT / QTI, ICS calendar feed, web-clipper bookmarklet                                                |
| 📱  | **Mobile**          | React Native (Expo) app in [`rn/`](rn/README.md) at full web parity, plus biometric lock, camera scan-to-summarize, offline review                     |

**AI providers** — Gemini · OpenAI · Claude · Grok · DeepSeek · Kimi · Doubao · Qwen · Wenxin Yiyan
(switchable from settings; keys stay client-side and travel per request)

---

## Tech Stack

**Backend** — .NET 10 · ASP.NET Core · EF Core 9 · MediatR · FluentValidation · SignalR · PostgreSQL + pgvector · S3 · yt-dlp · ffmpeg · Whisper.net · JWT
**Frontend** — React 19 · TypeScript 5.8 · Vite 6 · TailwindCSS 4 · React Router 7 · Tiptap · Markmap · Service Worker + idb-keyval
**Mobile** — React Native 0.86 · Expo SDK 57 · expo-router ([`rn/README.md`](rn/README.md))
**Shared** — `packages/core` (`@study/core`): API services, SSE reader and DTOs used by `web/` and `rn/`
**Architecture** — Clean Architecture · CQRS · Repository + Unit of Work · SSE streaming

---

## Local Setup

**Prerequisites** — .NET SDK 10 · Node.js 18+ · PostgreSQL 17 with
[pgvector](https://github.com/pgvector/pgvector) (stock Postgres will not migrate) · ffmpeg · AWS CLI.
You will need a Gemini API key, Google + GitHub OAuth apps, SMTP/SES email, and S3 or MinIO storage.
Redis is optional and off by default.

```bash
git clone https://github.com/ttang1024/AI_Study_Platform.git
cd AI_Study_Platform

# Database
psql postgres -c "CREATE USER studyplatform WITH PASSWORD 'yourpassword';"
psql postgres -c "CREATE DATABASE studyplatform OWNER studyplatform;"

# Storage (MinIO console: http://localhost:9001, minioadmin / minioadmin123)
docker compose up -d minio minio-init

# Backend — configure appsettings.Development.json first (below)
cd server
dotnet ef database update --project StudyPlatform.Infrastructure --startup-project StudyPlatform.API
dotnet run --project StudyPlatform.API     # → http://localhost:5001

# Frontend
cd web && npm install && npm run dev       # → http://localhost:3000
```

The mobile app is `cd rn && npm install && npx expo start` — see [`rn/README.md`](rn/README.md) for its env setup.

---

## Configuration

**`server/StudyPlatform.API/appsettings.Development.json`**

```jsonc
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=studyplatform;Username=studyplatform;Password=yourpassword",
  },
  "JwtSettings": { "SecretKey": "your-32-char-secret", "AccessTokenExpiryMinutes": 15, "RefreshTokenExpiryDays": 7 },
  "EmailSettings": { "Provider": "Ses", "FromEmail": "you@gmail.com", "SesRegion": "ap-southeast-2" },
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
  "Redis": { "Enabled": false }, // optional; cache falls through to the Postgres CacheEntries tier
  "AppLimits": { "DocumentUploadLimit": -1 }, // -1 = unlimited
  "Vapid": { "PublicKey": "", "PrivateKey": "" }, // optional browser push: npx web-push generate-vapid-keys
  "AiUsage": { "DailyTokenLimit": 0 }, // optional metering; see appsettings.Production.json for pricing
}
```

**`web/.env.local`** (and `admin/.env.local` with just `VITE_API_URL`)

```bash
VITE_API_URL=http://localhost:5001
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
VITE_GITHUB_CLIENT_ID=Ov23lic...
```

---

## Deployment

**Docker (self-hosted)** — bundles PostgreSQL and MinIO, so no external database or storage account
is needed.

```bash
cp .env.example .env          # fill in all values
docker compose up --build -d
docker compose exec api dotnet ef database update \
  --project StudyPlatform.Infrastructure --startup-project StudyPlatform.API
```

Web `:3000` · Admin `:4200` · API + Swagger `:5001` · MinIO console `:9001`. `VITE_*` values are baked
in at build time, so rebuild the frontend images after changing them.

**AWS** — `./deploy.sh` provisions ECS Fargate behind an ALB, S3 buckets, and static `web` / `admin`
frontends, pointing the API at Supabase. No RDS and no ElastiCache. Export
`DATABASE_CONNECTION_STRING`, `JWT_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`,
`SMTP_USER` and `SMTP_PASSWORD` first. The older topology is still there behind `DB_PROVIDER=rds`,
`ECS_LAUNCH_TYPE=EC2` and `REDIS_ENABLED=true`.

**[DEPLOYMENT.md](DEPLOYMENT.md)** is the full runbook — Supabase setup, connection strings, pooling,
migrations, scaling past one replica, and the video-transcript proxy settings YouTube needs from
cloud IPs.

---

## License

[MIT](LICENSE)
