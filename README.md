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

## Examples

I study with this platform myself and publish what it generates using the share button, real output from my own material, open to anyone, no account needed.

- **Transformers** (from a PDF) — summary, mind map, 14 flashcards, 4 quiz questions
  https://toto-study.com/share/Xlv92yWNx_6Q

- **Skills vs MCP vs RAG vs Memory** (from a YouTube video) — summary, mind map
  https://toto-study.com/share/oX9CnOx_QKxm

---

## Features

|     | Category          | What you get                                                                                       |
| --- | ----------------- | -------------------------------------------------------------------------------------------------- |
| 📄  | **Content**       | 234 document types (PDF, Office, eBooks, notebooks, code; OCR for scans), video from 11 sites or upload, audio, podcasts, web articles — duplicates caught by hash |
| 🤖  | **AI Generation** | Summaries, flashcards, adaptive quizzes, glossaries, mind maps, worked problems — each cites its source passage and goes stale when that source changes |
| 🎯  | **Study**         | FSRS-4.5 spaced repetition, per-user scheduler tuning, rich-text notes, chat with dictation and read-aloud, graded teach-back, photo problem capture |
| 🗓️  | **Today & Exams** | Daily plan, one-button **smart session** (due reviews + mistake redos + weak concepts), practice/exam mode, exam planner with AI mock exams and cram sheets, mistakes notebook |
| 📊  | **Insights**      | Time-on-task, accuracy trends, per-course mastery, knowledge gaps, AI recommendations, AI usage and cost |
| 🔎  | **Search**        | Semantic search that matches concepts, not words, plus ask-your-library answers with clickable citations |
| 🔊  | **Extras**        | Tags and collections, PDF annotations, text-to-speech, share links, offline PWA, push reminders, study groups with live chat |
| 🔄  | **Import/Export** | Anki, Markdown notes, quiz CSV / GIFT / QTI, ICS calendar feed, web-clipper bookmarklet |
| 📱  | **Mobile**        | [`rn/`](rn/README.md) Expo app at full web parity — biometric lock, camera scan-to-summarize, offline review |

**AI providers** — Gemini · OpenAI · Claude · Grok · DeepSeek · Kimi · Doubao · Qwen · Wenxin Yiyan.
Switchable from settings; keys stay client-side and travel per request.

---

## Tech Stack

**Backend** — .NET 10 · ASP.NET Core · EF Core 9 · MediatR · FluentValidation · SignalR · PostgreSQL + pgvector · S3 · yt-dlp · ffmpeg · Whisper.net · JWT
**Frontend** — React 19 · TypeScript 5.8 · Vite 6 · TailwindCSS 4 · React Router 7 · Tiptap · Markmap · Service Worker + idb-keyval
**Mobile** — React Native 0.86 · Expo SDK 57 · expo-router ([`rn/README.md`](rn/README.md))
**Shared** — `packages/core` (`@study/core`): API services, SSE reader and DTOs used by `web/` and `rn/`
**Architecture** — Clean Architecture · CQRS · Repository + Unit of Work · SSE streaming

---

## Local Setup

Needs .NET SDK 10 · Node 18+ · PostgreSQL 17 with
[pgvector](https://github.com/pgvector/pgvector) (stock Postgres will not migrate) · ffmpeg · AWS CLI,
plus a Gemini key, Google + GitHub OAuth apps, SMTP/SES email, and S3 or MinIO. Redis is optional and
off by default.

```bash
git clone https://github.com/ttang1024/AI_Study_Platform.git && cd AI_Study_Platform

psql postgres -c "CREATE USER studyplatform WITH PASSWORD 'yourpassword';"
psql postgres -c "CREATE DATABASE studyplatform OWNER studyplatform;"
docker compose up -d minio minio-init          # MinIO console :9001, minioadmin / minioadmin123

cd server                                      # configure appsettings.Development.json first (below)
dotnet ef database update --project StudyPlatform.Infrastructure --startup-project StudyPlatform.API
dotnet run --project StudyPlatform.API         # → http://localhost:5001

cd web && npm install && npm run dev           # → http://localhost:3000
cd rn  && npm install && npx expo start        # mobile; env setup in rn/README.md
```

---

## Configuration

**`server/StudyPlatform.API/appsettings.Development.json`**

```jsonc
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=studyplatform;Username=studyplatform;Password=yourpassword",
  },
  "JwtSettings": {
    "SecretKey": "your-32-char-secret",
    "AccessTokenExpiryMinutes": 15,
    "RefreshTokenExpiryDays": 7,
  },
  "EmailSettings": {
    "Provider": "Ses",
    "FromEmail": "you@gmail.com",
    "SesRegion": "ap-southeast-2",
  },
  // local MinIO
  "S3": {
    "BucketName": "documents-dev",
    "ServiceUrl": "http://localhost:9000",
    "PublicServiceUrl": "http://localhost:9000",
    "ForcePathStyle": true,
    "AccessKey": "minioadmin",
    "SecretKey": "minioadmin123",
  },
  "GoogleOAuth": { "ClientId": "xxxx.apps.googleusercontent.com", "ClientSecret": "GOCSPX-..." },
  "GitHubOAuth": { "ClientId": "Ov23lic...", "ClientSecret": "..." },
  "Cors": { "AllowedOrigins": ["http://localhost:3000", "http://localhost:3001"] },
  "Redis": { "Enabled": false }, // off → cache falls through to the Postgres CacheEntries tier
  "AppLimits": { "DocumentUploadLimit": -1 }, // -1 = unlimited
  "Vapid": { "PublicKey": "", "PrivateKey": "" }, // optional browser push: npx web-push generate-vapid-keys
  "AiUsage": { "DailyTokenLimit": 0 }, // optional metering; pricing in appsettings.Production.json
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

**Docker (self-hosted)** — bundles PostgreSQL and MinIO, so no external database or storage account is
needed.

```bash
cp .env.example .env          # fill in all values
docker compose up --build -d
docker compose exec api dotnet ef database update \
  --project StudyPlatform.Infrastructure --startup-project StudyPlatform.API
```

Web `:3000` · Admin `:4200` · API + Swagger `:5001` · MinIO console `:9001`. `VITE_*` values are baked
in at build time — rebuild the frontend images after changing them.

**AWS** — `./deploy.sh` provisions ECS Fargate behind an ALB, S3 + CloudFront for the `web` and
`admin` builds, and points the API at Supabase. No RDS, no ElastiCache.
[DEPLOYMENT.md](DEPLOYMENT.md) is the full runbook.

---

## License

[MIT](LICENSE)
