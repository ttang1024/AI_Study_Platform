<div align="center">

# Study Platform

### AI-powered learning — from any content, in any subject

[![.NET](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

Upload documents, YouTube videos, podcasts, and web articles — let AI generate summaries, flashcards, quizzes, glossaries, and mind maps. Master any topic with spaced repetition and an AI tutor.

---

![Study Platform demo](demos/StudyPlatformDemo.gif)

---

## Features

|     | Category             | What you get                                                                                                        |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 📄  | **Content Sources**  | PDF / DOCX upload, YouTube videos, web article clipping, audio files, Apple Podcasts                                |
| 🤖  | **AI Generation**    | Summaries, flashcards (basic / cloze / chart), quizzes, glossaries, mind maps, worked problems, concept links       |
| 🎯  | **Study Tools**      | Rich-text notes, AI tutor chat, scored quizzes, FSRS-4.5 spaced repetition, reinforcement center, knowledge graph   |
| 📚  | **Question Bank**    | Course-wide question bank with difficulty filter, mistake tracking, and answer-reveal per question                  |
| 🔊  | **Extra Features**   | PDF annotations, text-to-speech, Anki export, full-text search, shareable content links                            |
| 👥  | **Study Groups**     | Create / join groups, share courses & documents, real-time group chat                                               |
| 🔐  | **Auth**             | Email + OTP, Google OAuth, GitHub OAuth, JWT sessions                                                               |

**AI Providers** — Gemini · OpenAI · Claude · Grok · DeepSeek · Qwen · Wenxin Yiyan (multi-provider routing, switchable from settings)

---

## Tech Stack

**Backend** — .NET 10 · ASP.NET Core · EF Core 9 · MediatR · FluentValidation · PostgreSQL · Redis · Azure Blob Storage · Whisper.net · MailKit · JWT

**Frontend** — React 19 · TypeScript 5.8 · Vite 6 · TailwindCSS 4 · React Router 7 · Tiptap · D3.js + Markmap · Axios

**Architecture** — Clean Architecture · CQRS · Repository + Unit of Work · SSE streaming

---

## Prerequisites

| Software   | Version | Install                                                                                                      |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| .NET SDK   | 10.0    | [dotnet.microsoft.com](https://dotnet.microsoft.com/download)                                                |
| Node.js    | 18+     | [nodejs.org](https://nodejs.org)                                                                             |
| PostgreSQL | 14+     | [postgresql.org](https://www.postgresql.org/download)                                                        |
| Redis      | 7+      | [redis.io](https://redis.io/docs/latest/operate/oss_and_stack/install/install-redis/) / `brew install redis` |
| ffmpeg     | any     | `brew install ffmpeg` / `apt install ffmpeg`                                                                 |
| Azurite    | latest  | `npm install -g azurite`                                                                                     |

**Required API keys:** Google Gemini, Google OAuth 2.0, GitHub OAuth App, Gmail SMTP, Azure Storage (prod)

**Optional AI providers:** OpenAI, Anthropic Claude, DeepSeek, xAI Grok, Alibaba Qwen, Baidu Wenxin Yiyan

---

## Local Setup

```bash
# 1. Clone
git clone https://github.com/your-username/Study_Platform.git
cd Study_Platform

# 2. Create database
psql postgres -c "CREATE USER studyplatform WITH PASSWORD 'yourpassword';"
psql postgres -c "CREATE DATABASE studyplatform OWNER studyplatform;"

# 3. Start local services (keep running)
redis-server
azurite-blob --blobHost 127.0.0.1 --blobPort 10000

# 4. Configure backend — edit server/StudyPlatform.API/appsettings.Development.json

# 5. Run migrations
cd server
dotnet ef database update --project StudyPlatform.Infrastructure --startup-project StudyPlatform.API

# 6. Start backend
dotnet run --project StudyPlatform.API     # → http://localhost:5000

# 7. Start frontend
cd web && cp .env.example .env.local && npm install && npm run dev   # → http://localhost:3000
cd admin && npm install && npm run dev                                # → http://localhost:3001
```

---

## Environment Variables

**`server/StudyPlatform.API/appsettings.Development.json`**

```jsonc
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=studyplatform;Username=studyplatform;Password=yourpassword"
  },
  "Redis": {
    "ConnectionString": "localhost:6379",
    "InstanceName": "StudyPlatform:"
  },
  "JwtSettings": {
    "SecretKey": "your-32-char-secret",
    "Issuer": "Study Platform",
    "Audience": "Study Platform Users",
    "AccessTokenExpiryMinutes": 15,
    "RefreshTokenExpiryDays": 7
  },
  "EmailSettings": {
    "FromEmail": "you@gmail.com",
    "SmtpHost": "smtp.gmail.com",
    "SmtpPort": 587,
    "SmtpUser": "you@gmail.com",
    "SmtpPassword": "xxxx xxxx xxxx xxxx" // Gmail App Password
  },
  "AzureStorage": {
    "ConnectionString": "UseDevelopmentStorage=true",
    "ContainerName": "documents-dev"
  },
  "GoogleOAuth": { "ClientId": "xxxx.apps.googleusercontent.com", "ClientSecret": "GOCSPX-..." },
  "GitHubOAuth": { "ClientId": "Ov23lic...", "ClientSecret": "..." },
  "Cors": { "AllowedOrigins": ["http://localhost:3000", "http://localhost:3001"] },
  "AppLimits": { "DocumentUploadLimit": -1 } // -1 = unlimited for local dev
}
```

**`web/.env.local`**

```bash
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
VITE_GITHUB_CLIENT_ID=Ov23lic...
```

**`admin/.env.local`**

```bash
VITE_API_URL=http://localhost:5000
```

---

## Upload Limits

The hosted deployment enforces a **10-document upload limit per account** to control storage costs. Set `AppLimits__DocumentUploadLimit=-1` to disable the limit in a self-hosted environment.

---

## Deployment

### Docker (self-hosted)

Includes PostgreSQL and Redis — no external database or cache needed.

```bash
cp .env.example .env          # fill in all values
docker compose up --build -d
docker compose exec api dotnet ef database update \
  --project StudyPlatform.Infrastructure --startup-project StudyPlatform.API
```

| Service  | URL                           |
| -------- | ----------------------------- |
| Web      | http://localhost:3000         |
| Admin    | http://localhost:4200         |
| API      | http://localhost:5000         |
| Swagger  | http://localhost:5000/swagger |

> `VITE_*` variables are baked in at build time — rebuild frontend images after changing them.

### Azure Deployment

Use `deploy.sh` for the first Azure deployment. It provisions the API, PostgreSQL, storage, and static `web`/`admin` frontends.

```bash
export DB_PASS=...
export JWT_SECRET=...
export GOOGLE_CLIENT_ID=...
export GOOGLE_CLIENT_SECRET=...
export GITHUB_CLIENT_ID=...
export GITHUB_CLIENT_SECRET=...
export SMTP_USER=...
export SMTP_PASSWORD=...

bash deploy.sh
```

### YouTube Subtitle Fetching (Production)

YouTube may block subtitle requests from cloud IPs. Route yt-dlp traffic through a proxy:

```bash
# SOCKS / HTTP proxy
export YOUTUBE_PROXY_URL="socks5://USERNAME:PASSWORD@proxy.example.com:PORT"

# Cookie authentication (for videos requiring sign-in)
export YOUTUBE_COOKIES_B64="$(base64 < cookies.txt | tr -d '\n')"

./deploy-backend.sh
```

---

## License

[MIT](LICENSE)
