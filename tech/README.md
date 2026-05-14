# AI Study Platform — Technical Documentation

This folder contains per-topic technical references for the AI Study Platform. Each document covers routes, backend implementation, data model, and relevant frontend files for one feature area.

---

## Stack at a Glance

| Layer | Technology |
| --- | --- |
| **API** | ASP.NET Core (.NET 10), MediatR, EF Core 9, SignalR |
| **Database** | PostgreSQL via Npgsql; migrations applied on startup |
| **Cache** | Redis (primary) with PostgreSQL `CacheEntries` table as persistent fallback |
| **AI providers** | Gemini, OpenAI, Claude, DeepSeek, Grok, Qwen, Wenxin, Kimi, Doubao — selected per-request via `X-AI-Provider` / `X-AI-Model` / `X-AI-Key` headers |
| **File storage** | Azure Blob Storage (production); Azurite for local dev |
| **Transcription** | yt-dlp captions + Whisper.net fallback |
| **TTS** | Microsoft Edge TTS (`edge-tts` CLI) |
| **Web frontend** | React 19 + Vite (TypeScript) |
| **Admin frontend** | React 19 + Vite (separate app, port 3001) |
| **Real-time chat** | SignalR (`/hubs/group-chat`) |

---

## Architecture

```
┌─────────────┐    ┌─────────────────────────────────────────────┐
│  Web (React) │    │  ASP.NET Core API                            │
│  port 3000   │───▶│  Controllers → MediatR → Handlers            │
├─────────────┤    │  ├─ Application layer (commands / queries)   │
│ Admin (React)│    │  ├─ Domain (entities, repo interfaces)       │
│  port 3001   │───▶│  └─ Infrastructure (EF Core, services, AI)  │
└─────────────┘    └──────────┬──────────────┬───────────────────┘
                              │              │
                     ┌────────▼──┐   ┌───────▼──────┐
                     │ PostgreSQL │   │  Redis cache  │
                     │ + EF Core  │   │  (optional)   │
                     └───────────┘   └──────────────┘
```

See [architecture.md](architecture.md) for the full middleware pipeline, Result pattern, and JWT/SignalR details.

---

## AI Generation Pipeline

All generation features share the same three-layer structure:

```
Controller endpoint
  └─ IAiService.Generate*Async(content, ...)   ← provider-agnostic
       └─ IAppCache.GetOrCreateAsync(...)       ← Redis / PG cache
            └─ HTTP POST to provider API        ← any supported LLM
```

Source content is resolved before the AI call:
- **Documents** → `IDocumentTextExtractor.ExtractTextAsync` or raw file bytes for multimodal providers.
- **YouTube videos** → stored `Transcript` field, or live `IYouTubeTranscriptService` fetch.

Long outputs stream to the client via SSE (`IAsyncEnumerable<string>` → `SseExtensions.WriteSseDataAsync`).

See [ai-generation.md](ai-generation.md) and [ai-chat.md](ai-chat.md).

---

## Study Capabilities

| Capability | Backend | Frontend |
| --- | --- | --- |
| Summaries (SSE) | `DocumentsController`, `YouTubeController`, `AiService` | summarizer tabs, detail pages |
| Mind maps (SSE) | document/video stream routes | `MindMapViewer` |
| Flashcards + FSRS | `FlashcardsController`, `FsrsService` | `FlashcardsPage`, `ReinforcementCenterPage` |
| Quizzes + Question Bank | document/video quiz routes, `QuestionBankController` | `QuizManagementPage` |
| Glossary + mastery | `GlossaryController`, source glossary routes | `GlossaryPage` |
| Notes | `NotesController` | `NotesPage`, `RichTextEditor` |
| AI Chat (SSE) | `AiController`, document/video chat routes | `ChatListPage`, `ChatPanel` |
| Knowledge graph | `ConceptLinksController` | `KnowledgeGraphPage` (d3) |
| Worked problems | `WorkedProblemsController` | `WorkedProblemsPanel` |
| TTS | `TtsSynthesisController` (edge-tts) | `TtsPlayer`, `TtsContext` |
| Annotations → flashcard | `AnnotationsController` | `AnnotatedPdfViewer` |
| Podcast / Audio | `PodcastController`, `AudioController`, Whisper | `PodcastTab`, `AudioDetailPage` |
| Share links | `ShareController` | `SharedContentPage` |
| Study groups + chat | `StudyGroupsController`, `GroupChatHub` | `StudyGroupDetailPage` |
| Search | `SearchController` | `SearchResultsPage` |
| Analytics | `AnalyticsController`, `StatsController` | `DashboardPage` |

---

## Documentation Index

### Core Infrastructure
- [architecture.md](architecture.md) — Clean Architecture layout, middleware pipeline, Result pattern, JWT setup
- [database.md](database.md) — PostgreSQL, EF Core, `AppDbContext`, `UnitOfWork`, entity configurations, migrations
- [redis.md](redis.md) — Redis setup, `DistributedAppCache` two-tier stack, circuit breaker, PostgreSQL fallback
- [auth.md](auth.md) — Login, token refresh, OAuth, OTP flow
- [google-identity-services.md](google-identity-services.md) — Google One Tap and OAuth credential handlers

### Content Sources
- [documents.md](documents.md) — File upload (blob storage, upload limit), SSE summary, document routes
- [youtube.md](youtube.md) — yt-dlp with proxy/cookie rotation, transcript resegmentation, Whisper fallback
- [podcast.md](podcast.md) — Podcast import, audio upload, Whisper singleton lazy-load
- [annotations.md](annotations.md) — PDF highlight/note create, flashcard-from-annotation

### AI Features
- [ai-generation.md](ai-generation.md) — Provider routing, `SendTextAsync`, `StreamTextAsync`, request builder, JSON cleanup, caching
- [ai-chat.md](ai-chat.md) — Chat modes (document / YouTube / general), SSE streaming pattern
- [flashcards.md](flashcards.md) — FSRS-4.5 algorithm (`FsrsService`), review handler, SRS state
- [quiz.md](quiz.md) — Quiz generation, question bank, submission upsert
- [glossary.md](glossary.md) — Term generation, mastery toggle
- [worked-problems.md](worked-problems.md) — Generation, attempt evaluation, mastery toggle
- [knowledge-graph.md](knowledge-graph.md) — Graph builder, node merge, edge deduplication
- [tts.md](tts.md) — edge-tts subprocess, temp-file injection safety

### Organisation & Social
- [courses.md](courses.md) — Course CRUD, cascade delete
- [notes.md](notes.md) — Create, update, paginated list
- [share.md](share.md) — Share token generation, expiry, audio SAS redirect, file proxy
- [study-groups.md](study-groups.md) — Group management, SignalR `GroupChatHub`

### Cross-Cutting
- [search.md](search.md) — Parallel multi-entity search, snippet extraction
- [analytics.md](analytics.md) — Daily quiz accuracy (cached), attempt recording
- [admin.md](admin.md) — Admin login, user management, feedback workflow

### Infrastructure & Ops
- [deploy.md](deploy.md) — Azure deployment scripts, required config keys, CORS, JWT expiry header
- [docker.md](docker.md) — Compose stack, EF migrate-on-start, runtime ENV injection
- [unit-test.md](unit-test.md) — Moq + xUnit patterns, toggle-command testing

---

## Key Config Keys

| Key | Purpose |
| --- | --- |
| `ConnectionStrings:DefaultConnection` | PostgreSQL |
| `ConnectionStrings:Redis` / `Redis:ConnectionString` | Redis (optional) |
| `JwtSettings:SecretKey` | JWT signing key |
| `Cors:AllowedOrigins` | Allowed frontend origins |
| `Cache:AiGenerationSeconds` | AI result TTL (default 30 days) |
| `Cache:TranscriptSeconds` | Transcript TTL (default 30 days) |
| `Cache:OperationTimeoutMilliseconds` | Redis per-op timeout (default 500 ms) |
| `YouTube:ProxyUrls` / `YouTube:CookiesList` | yt-dlp proxy/cookie pool |
| `Whisper:Model` | Whisper model size (`base` default) |
| `Blob:ConnectionString` | Azure Blob Storage |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Application Insights telemetry |
