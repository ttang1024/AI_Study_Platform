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

|     | Category            | What you get                                                                                                      |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 📄  | **Content Sources** | PDF / DOCX upload, YouTube videos, web article clipping, audio files, Apple Podcasts                              |
| 🤖  | **AI Generation**   | Summaries, flashcards (basic / cloze / chart), quizzes, glossaries, mind maps, worked problems, concept links     |
| 🎯  | **Study Tools**     | Rich-text notes, AI tutor chat, scored quizzes, FSRS-4.5 spaced repetition, reinforcement center, knowledge graph |
| 📚  | **Question Bank**   | Course-wide question bank with difficulty filter, mistake tracking, and answer-reveal per question                |
| 🔊  | **Extra Features**  | PDF annotations, text-to-speech, Anki export, full-text search, shareable content links                           |
| 👥  | **Study Groups**    | Create / join groups, share courses & documents, real-time group chat                                             |
| 🔐  | **Auth**            | Email + OTP, Google OAuth, GitHub OAuth, JWT sessions                                                             |

**AI Providers** — Gemini · OpenAI · Claude · Grok · DeepSeek · Kimi · Doubao · Qwen · Wenxin Yiyan (multi-provider routing, switchable from settings)

---

## Tech Stack

**Backend** — .NET 10 · ASP.NET Core · EF Core 9 · MediatR · FluentValidation · SignalR · PostgreSQL · Redis · Amazon S3 · Whisper.net · MailKit · JWT

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
| AWS CLI    | latest  | [aws.amazon.com/cli](https://aws.amazon.com/cli/)                                                            |

**Required API keys/services:** Google Gemini, Google OAuth 2.0, GitHub OAuth App, Gmail SMTP, Amazon S3 or MinIO-compatible storage

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

# 3. Start local services
redis-server
docker compose up -d minio minio-init

# MinIO console: http://localhost:9001
# Login: minioadmin / minioadmin123
# Bucket: documents-dev

# 4. Configure backend — edit server/StudyPlatform.API/appsettings.Development.json
# Ensure the S3 section points at local MinIO:
# "ServiceUrl": "http://localhost:9000"
# "PublicServiceUrl": "http://localhost:9000"
# "ForcePathStyle": true

# 5. Run migrations
cd server
dotnet ef database update --project StudyPlatform.Infrastructure --startup-project StudyPlatform.API

# 6. Start backend
dotnet run --project StudyPlatform.API     # → http://localhost:5001

# 7. Start frontend
cd web && npm install && npm run dev   # → http://localhost:3000
```

---

## Environment Variables

**`server/StudyPlatform.API/appsettings.Development.json`**

```jsonc
{
	"ConnectionStrings": {
		"DefaultConnection": "Host=localhost;Port=5432;Database=studyplatform;Username=studyplatform;Password=yourpassword",
	},
	"Redis": {
		"Enabled": false,
		"ConnectionString": "localhost:6379",
		"InstanceName": "StudyPlatform:",
	},
	"JwtSettings": {
		"SecretKey": "your-32-char-secret",
		"Issuer": "Study Platform",
		"Audience": "Study Platform Users",
		"AccessTokenExpiryMinutes": 15,
		"RefreshTokenExpiryDays": 7,
	},
	"EmailSettings": {
		"Provider": "Ses",
		"FromEmail": "you@gmail.com",
		"SesRegion": "ap-southeast-2",
		"SmtpHost": "smtp.gmail.com",
		"SmtpPort": 587,
		"SmtpUser": "you@gmail.com",
		"SmtpPassword": "xxxx xxxx xxxx xxxx", // SMTP fallback only
	},
	"AWS": {
		"Region": "us-east-1",
	},
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
	"AppLimits": { "DocumentUploadLimit": -1 }, // -1 = unlimited for local dev
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

The hosted deployment enforces a **20-document upload limit per account** to control storage costs. Set `AppLimits__DocumentUploadLimit=-1` to disable the limit in a self-hosted environment.

---

## Deployment

### Docker (self-hosted)

Includes PostgreSQL, Redis, and MinIO for S3-compatible local file storage. No external database, cache, or object storage account is needed.

```bash
cp .env.example .env          # fill in all values
docker compose up --build -d
docker compose exec api dotnet ef database update \
  --project StudyPlatform.Infrastructure --startup-project StudyPlatform.API
```

| Service | URL                           |
| ------- | ----------------------------- |
| Web     | http://localhost:3000         |
| Admin   | http://localhost:4200         |
| API     | http://localhost:5000         |
| Swagger | http://localhost:5000/swagger |
| MinIO   | http://localhost:9001         |

> `VITE_*` variables are baked in at build time — rebuild frontend images after changing them.
> MinIO uses `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` from `.env`; the defaults are `minioadmin` / `minioadmin123`, and uploaded documents are stored in `S3_BUCKET_NAME` (`documents-dev` by default). `S3_PUBLIC_SERVICE_URL` should be a host-browser reachable URL for generated download links.

### AWS Deployment

Use `deploy.sh` for the first AWS deployment. It provisions ECS on a low-cost EC2 instance and an Application Load Balancer for the API, RDS PostgreSQL, ElastiCache Redis, S3 document/static buckets, and static `web`/`admin` frontends.

The API host defaults to `ECS_EC2_INSTANCE_TYPE=t3.micro` with `ECS_MEMORY=768`. Override those values before running the script if the API needs more headroom.

```bash
export DB_PASS=...
export JWT_SECRET=...
export GOOGLE_CLIENT_ID=...
export GOOGLE_CLIENT_SECRET=...
export GITHUB_CLIENT_ID=...
export GITHUB_CLIENT_SECRET=...
export SMTP_USER=...
export SMTP_PASSWORD=...

./deploy.sh
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
