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

Upload documents in 80+ formats, videos (paste any link — YouTube · Bilibili · Vimeo · TED · Dailymotion · TikTok · Facebook · Instagram · X · Reddit · LinkedIn, auto-detected — or your own files), podcasts (paste any episode link, RSS feed, or MP3), and web articles — AI generates summaries, flashcards, quizzes, glossaries, and mind maps. Master any topic with spaced repetition, one-button daily smart sessions, an exam planner with AI mock exams and cram sheets, and a hands-free voice tutor.

---

![Study Platform demo](demos/StudyPlatformDemo.gif)

---

## Features

|     | Category             | What you get                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📄  | **Content Sources**  | 80+ document formats — PDF (scanned PDFs & images get AI OCR), Office incl. legacy `.doc`/`.ppt`/`.xls`, OpenDocument, iWork, eBooks (EPUB / MOBI / FB2), email (EML / MSG / MHTML), XPS / Visio / SVG, Jupyter notebooks, subtitles, LaTeX / Markdown / HTML / RTF, source code — plus online video from 11 sites auto-detected from the pasted link (YouTube & Bilibili with playlist / multi-part import; Vimeo, TED, Dailymotion; public TikTok, Facebook, Instagram, X/Twitter, Reddit, LinkedIn posts), uploaded videos & audio (most containers), web article clipping, podcasts from any episode link (Apple Podcasts, Overcast, Castro, Pocket Casts, Podbean, Buzzsprout & more — plus RSS feeds with an episode picker and direct MP3 links). Re-adding the same file or link is caught by content hash and takes you to the existing copy instead of duplicating it |
| 🤖  | **AI Generation**    | Summaries, flashcards (basic / cloze / chart), adaptive quizzes (difficulty tunes to your performance on the material), glossaries, mind maps, worked problems                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 🎯  | **Study Tools**      | Rich-text notes, hands-free voice tutor (speaks, listens, and answers back), graded teach-back, photo problem capture, FSRS-4.5 spaced repetition, question bank, knowledge graph & learning paths                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 🗓️  | **Today & Practice** | Daily study plan with goal budgeting, one-button **smart session** (due reviews + mistake redos + weak concepts, interleaved), unified Practice / Exam mode (quiz · flashcard · glossary · problem), timed runner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 🎓  | **Exam Prep**        | Exam planner with countdown & day-by-day schedule, AI cram sheets built from your weak spots, timed AI mock exams, mistakes notebook, reinforcement center                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 📊  | **Insights**         | Time-on-task & accuracy analytics, per-course mastery, knowledge-gap detection, AI recommendations, AI usage & estimated cost, XP & levels                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 🔔  | **Reminders**        | Browser push reminders when flashcards come due (Web Push), notification digest — due cards, streak-at-risk, daily-goal progress, top knowledge gaps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 📴  | **Offline PWA**      | Installable app shell; flashcards & glossary cached for offline review with background sync                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 🔊  | **Extras**           | PDF annotations, text-to-speech, semantic full-text search across documents, videos, notes, flashcards & glossary (finds related concepts even when the words differ) + ask-your-library AI answers with clickable source citations, public share links                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 🔗  | **Citations**        | Every generated card, term, and answer links back to the exact source passage; re-uploading a document flags the artifacts generated from the old version as stale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 🏷️  | **Organize**         | Tags and collections on anything in your library, plus saved views that turn a filter set you keep retyping into one click                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 🔄  | **Import / Export**  | Anki import & export, Notion / Markdown ZIP import, study-pack export (PDF / CSV), Obsidian-ready Markdown vault export, ICS calendar feed, web clipper, highlight-to-flashcard from any web page                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 🧑‍💻  | **Developer API**    | Scoped API keys sent as `X-Api-Key` (`library:read` · `library:write` · `flashcards:read` · `flashcards:write` · `analytics:read`), and outbound webhooks for `document.created`, `flashcards.generated`, `quiz.completed`, `reviews.due`, and `certificate.issued`, signed with HMAC-SHA256 over `{timestamp}.{body}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 👥  | **Groups**           | Shared courses & documents, real-time chat, live co-study rooms with shared focus timer, assignments, live quiz battles, XP leaderboard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 🏫  | **Classrooms**       | Teacher-run classrooms with rosters, assignments, and a gradebook                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 🏅  | **Certificates**     | Reach 80% mastery on a course to issue a completion certificate with a public verification link anyone can check without an account; revocable at any time                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 🧰  | **Tools**            | AI essay grading against rubrics, double-blind peer review of drafts against that same rubric, in-browser Python code cells (Pyodide), handwriting grading, language-learning mode                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 💳  | **Plans**            | Free / Pro / Team subscriptions with usage quotas; a Team plan covers every member of an organization                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 🔐  | **Auth**             | Email + OTP, Google / GitHub OAuth, JWT sessions, optional two-factor auth, guided onboarding checklist, English & Spanish UI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 🛡️  | **Account Security** | Two-factor auth via any authenticator app with one-time recovery codes, a live list of signed-in devices you can revoke individually or all at once, and your own security log of sign-ins and factor changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 📦  | **Your Data**        | Request a full export of everything the platform holds on you, downloaded through a short-lived signed URL — or schedule account deletion, which cuts off access immediately and erases the data after a grace period you can cancel within                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 📱  | **Mobile App**       | React Native (Expo) app in [`rn/`](rn/README.md) with full web-feature parity, plus biometric app lock, camera scan-to-summarize, haptic study feedback, keep-awake exams, offline review, and push reminders                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

**AI Providers** — Gemini · OpenAI · Claude · Grok · DeepSeek · Kimi · Doubao · Qwen · Wenxin Yiyan (multi-provider routing, switchable from settings)

---

## Tech Stack

**Backend** — .NET 10 · ASP.NET Core · EF Core 9 · MediatR · FluentValidation · SignalR · PostgreSQL · Redis · Amazon S3 · yt-dlp · ffmpeg · Whisper.net · MailKit · JWT

**Frontend** — React 19 · TypeScript 5.8 · Vite 6 · TailwindCSS 4 · React Router 7 · Tiptap · D3.js + Markmap · Pyodide · Service Worker + idb-keyval (offline PWA)

**Mobile** — React Native 0.86 · Expo SDK 57 · expo-router · SignalR · WebView-hosted pdf.js / KaTeX / markmap (see [`rn/README.md`](rn/README.md))

**Shared** — `packages/core` (`@study/core`): platform-agnostic API services, SSE stream reader, and DTOs consumed by `web/`, `rn/`, and `extension/`

> **Build systems:** Vite (`npm run dev` / `npm run build`) is the production path — `deploy.sh` ships `web/dist` to S3/CloudFront. The Next.js scripts (`dev:next` / `build:next` / `start:next`) are an alternative SSR entry (`web/src/app`) added for landing/share-page SEO experiments and are **not** deployed; keep changes working under Vite first.

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
  "Redis": { "Enabled": false, "ConnectionString": "localhost:6379" },
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
  "AppLimits": { "DocumentUploadLimit": -1 }, // -1 = unlimited; hosted default is 10 documents / audio / video uploads per account
  // Optional — enables browser push reminders for due flashcards.
  // Generate a key pair once with: npx web-push generate-vapid-keys
  "Vapid": { "PublicKey": "", "PrivateKey": "", "Subject": "mailto:you@example.com" },
  // Optional — AI token metering. DailyTokenLimit 0 = unlimited; Pricing is per-million
  // tokens keyed by model-name prefix (longest match wins) and drives the cost estimates
  // in the AI-usage view. Unpriced models still log tokens, just with a $0 estimate.
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

Clip any web page into your library as a cleaned-up Markdown article:

- **Browser extension** — load `extension/` as an unpacked extension (Chrome / Edge / Brave). Also adds a right-click **Save selection as flashcard** action: the highlighted text becomes the front, AI writes the back. See [extension/README.md](extension/README.md).
- **Bookmarklet** — Settings → Export → **Web Clipper bookmarklet**; no install needed.

---

## Deployment

### Docker (self-hosted)

Bundles PostgreSQL, Redis, and MinIO — no external database, cache, or storage account needed.

```bash
cp .env.example .env          # fill in all values
docker compose up --build -d
docker compose exec api dotnet ef database update \
  --project StudyPlatform.Infrastructure --startup-project StudyPlatform.API
```

Web `:3000` · Admin `:4200` · API + Swagger `:5001` · MinIO console `:9001`

> `VITE_*` variables are baked in at build time — rebuild frontend images after changing them. MinIO credentials and bucket come from `.env` (`MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` / `S3_BUCKET_NAME`); `S3_PUBLIC_SERVICE_URL` must be reachable from the host browser.

### AWS

`./deploy.sh` provisions ECS on a low-cost EC2 instance (`t3.micro`, `ECS_MEMORY=768` by default — override for more headroom), an ALB for the API, RDS PostgreSQL, ElastiCache Redis, S3 buckets, and static `web` / `admin` frontends. Export `DB_PASS`, `JWT_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`, `SMTP_USER`, and `SMTP_PASSWORD` before running it.

### Scaling out

The API runs multiple replicas: SignalR picks up a Redis backplane whenever Redis is configured and answers a startup ping, and degrades to instance-local delivery if Redis dies later. Set `Api:RequireScaleOutBackplane=true` so a missing backplane fails startup instead of silently half-delivering hub messages. AI generation jobs stay pinned to the replica that accepted them (their provider credentials never touch the database).

### Video transcripts (production)

Online videos (YouTube, Bilibili, Vimeo, TED, Dailymotion, TikTok, and public social posts) use native captions when available (YouTube json3 or WebVTT), then fall back to yt-dlp + Whisper; uploaded videos are transcribed with ffmpeg + Whisper. YouTube may block cloud IPs — set `YOUTUBE_PROXY_URL` (SOCKS/HTTP proxy) and optionally `YOUTUBE_COOKIES_B64="$(base64 < cookies.txt | tr -d '\n')"` before running `./deploy-backend.sh`.

---

## License

[MIT](LICENSE)
