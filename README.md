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

## Features

|     | Category            | What you get                                                                                                       |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 📄  | **Content Sources** | PDF / DOCX upload, YouTube videos, web article clipping, audio files, Apple Podcasts                               |
| 🤖  | **AI Generation**   | Summaries, flashcards, quizzes, glossaries, mind maps — Gemini, OpenAI, Claude, DeepSeek, Grok, Qwen, Wenxin Yiyan |
| 🎯  | **Study Tools**     | rich-text notes, AI tutor chat, scored quizzes                                                                     |
| 🧪  | **Problems**        | Step-by-step solving — AI breaks down problems, hints each stage, explains solutions                               |
| 🎙️  | **Audio**           | Offline transcription via Whisper.net, text-to-speech playback                                                     |
| 👥  | **Study Groups**    | Create/join groups, share documents, quizzes, and flashcard sets                                                   |
| 🔐  | **Auth**            | Email + OTP, Google OAuth, GitHub OAuth, JWT sessions                                                              |

---

## Tech Stack

**Backend** — .NET 10 · ASP.NET Core · EF Core 9 · MediatR · FluentValidation · PostgreSQL · Redis · Azure Blob Storage · Whisper.net · MailKit · JWT

**Frontend** — React 19 · TypeScript 5.8 · Vite 6 · TailwindCSS 4 · React Router 7 · Tiptap · D3.js + Markmap · Axios

**Architecture** — Clean Architecture · CQRS · Repository + Unit of Work · multi-provider AI routing

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
		"DefaultConnection": "Host=localhost;Port=5432;Database=studyplatform;Username=studyplatform;Password=yourpassword",
	},
	"Redis": {
		"ConnectionString": "localhost:6379",
		"InstanceName": "StudyPlatform:",
	},
	"Cache": {
		"DashboardStatsSeconds": 60,
		"DocumentMetadataSeconds": 60,
		"AnalyticsSummarySeconds": 300,
		"GeneratedResultSeconds": 3600,
	},
	"JwtSettings": {
		"SecretKey": "your-32-char-secret",
		"Issuer": "Study Platform",
		"Audience": "Study Platform Users",
		"AccessTokenExpiryMinutes": 15,
		"RefreshTokenExpiryDays": 7,
	},
	"EmailSettings": {
		"FromEmail": "you@gmail.com",
		"SmtpHost": "smtp.gmail.com",
		"SmtpPort": 587,
		"SmtpUser": "you@gmail.com",
		"SmtpPassword": "xxxx xxxx xxxx xxxx", // Gmail App Password
	},
	"AzureStorage": {
		"ConnectionString": "UseDevelopmentStorage=true",
		"ContainerName": "documents-dev",
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

The hosted (Azure) deployment enforces a **5-document upload limit per account** to control storage costs.

| Environment        | Limit       | How it's set                                                          |
| ------------------ | ----------- | --------------------------------------------------------------------- |
| Production (Azure) | 5 documents | `AppLimits__DocumentUploadLimit=5` via env var                        |
| Local development  | Unlimited   | `AppLimits.DocumentUploadLimit: -1` in `appsettings.Development.json` |

To change the limit in a self-hosted deployment, set `DOCUMENT_UPLOAD_LIMIT` in your `.env` file (or `AppLimits__DocumentUploadLimit` directly in your hosting environment). Use `-1` to disable the limit entirely.

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
| Postgres | localhost:5432                |
| Redis    | localhost:6379                |

> `VITE_*` variables are baked in at build time — rebuild frontend images after changing them.

### Azure Free Credit Deployment

`deploy.sh` is the first-time Azure deployment script for a Free/$200 credit account. It keeps only the API in Azure Container Apps, scales it to zero when idle, and hosts `web` and `admin` as Azure Storage static websites instead of frontend containers.

```bash
# Set required env vars
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

The script creates the Azure Storage connection string automatically. Set `AZURE_STORAGE_CONNECTION_STRING` only if you want to use an existing storage account for uploaded documents.

Resources created:

| Resource                   | Details                                   |
| -------------------------- | ----------------------------------------- |
| Azure Container Registry   | stores the `api` image only               |
| Container Apps environment | hosts the API container app               |
| Container App              | `api`, external ingress, min replicas `0` |
| Storage account            | uploaded documents, container `documents` |
| Storage static website     | public `web` frontend                     |
| Storage static website     | public `admin` frontend                   |
| PostgreSQL Flexible Server | v17, Standard_B1ms, 32 GB                 |

Generated Azure resource names include a suffix from the current subscription ID. Override it when needed:

```bash
export AZURE_NAME_SUFFIX=myuniquesuffix
```

Azure Free subscriptions can be limited to one Container Apps environment per region. If one already exists in `LOCATION`, `deploy.sh` reuses it automatically instead of creating another one.

PostgreSQL availability is also subscription- and region-dependent. The script keeps the app resources in `LOCATION` and creates PostgreSQL in `DB_LOCATION`, which defaults to `westus3` because `eastus` and `eastus2` can be restricted for Flexible Server on some free subscriptions.

```bash
export DB_LOCATION=centralus
bash deploy.sh
```

You can also point the deployment at a known existing environment explicitly:

```bash
export ENVIRONMENT=smart-cv-app-env
bash deploy.sh
```

Cost controls:

| Area      | Control                                                |
| --------- | ------------------------------------------------------ |
| API       | Container App uses `--min-replicas 0 --max-replicas 1` |
| Frontends | Static website hosting instead of two containers       |
| Uploads   | Production document uploads default to 5 per account   |
| Storage   | Standard_LRS storage accounts                          |

PostgreSQL Flexible Server still consumes Azure credit while it exists. For a short-lived demo on a Free/$200 account, delete the resource group when finished or stop the PostgreSQL server from the Azure portal when you are not testing.

If you previously deployed the old three-Container-App layout, delete the old `web` and `admin` Container Apps after the static websites are working so they do not keep using credit.

For later code changes, use the smaller deploy scripts instead of reprovisioning everything.

**Deploy frontends only**

Use this after changes under `web/` or `admin/`.

```bash
export GOOGLE_CLIENT_ID=...
export GITHUB_CLIENT_ID=...

./deploy-web.sh
```

This rebuilds both Vite apps with `VITE_API_URL` set to the deployed API URL, then uploads `web/dist` and `admin/dist` to their static website storage accounts.

**Deploy backend API only**

Use this after changes under `server/`.

```bash
export DB_PASS=...
export JWT_SECRET=...
export GOOGLE_CLIENT_ID=...
export GOOGLE_CLIENT_SECRET=...
export GITHUB_CLIENT_ID=...
export GITHUB_CLIENT_SECRET=...
export SMTP_USER=...
export SMTP_PASSWORD=...

./deploy-backend.sh
```

This rebuilds and pushes the `api` image, updates the API Container App, keeps scale-to-zero enabled, and refreshes the production backend environment variables.

### 🎬 Production YouTube Subtitle Fetching

YouTube may block subtitle requests from Azure IPs. Route yt-dlp traffic through a non-Azure SOCKS or HTTP proxy by setting `YOUTUBE_PROXY_URL` before deploying the backend:

```bash
export YOUTUBE_PROXY_URL="socks5://USERNAME:PASSWORD@proxy.webshare.io:PORT"
./deploy-backend.sh
```

For videos that require authenticated cookies, base64-encode a Netscape-format `cookies.txt` file and deploy it as `YOUTUBE_COOKIES_B64`:

```bash
export YOUTUBE_COOKIES_B64="$(base64 < cookies.txt | tr -d '\n')"
./deploy-backend.sh
```

---

## License

[MIT](LICENSE)
