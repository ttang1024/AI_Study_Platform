# toto.ai — mobile app

React Native (Expo SDK 57, expo-router, TypeScript) client for the AI Study Platform. It has full
feature parity with the web app in `../web`, plus mobile-native features that only make sense on a
phone. It talks to the same .NET backend in `../server`.

## Features

**Study core** — Library (courses, documents, videos, podcasts) with server-paginated search,
document/video detail with summaries, mind maps, PDF viewing with cross-platform highlights/annotations,
FSRS flashcard review, quizzes (client-graded, timed exams, server-graded planner mock exams),
notes with a rich-text editor, glossary, worked problems, and a practice center.

**AI tools** — general and document/video-scoped chat (with image/PDF attachments and voice input),
"Ask the library" RAG search, summarizer for ~50 document formats plus video/web/audio/pasted-text
sources, AI cram sheets, study planner schedules, and an AI usage view (Settings → AI usage: token
spend and estimated cost broken down by provider and model).

**Social & progress** — study groups with realtime chat (SignalR), quiz battles, live study rooms with
shared pomodoro, assignments, leaderboards, achievements, insights/analytics charts, knowledge-graph
concepts and gaps, recommendations, and public share links (create and view).

**Mobile-native** — biometric app lock (Face ID / Touch ID / fingerprint), camera scan of textbook
pages or handwritten notes into the summarizer (backend OCR), haptic feedback on flashcard grading and
quiz answers, keep-awake during reviews and exams, offline read-only flashcards/glossary, daily local
study reminders, and due-card push notifications (dormant until an EAS build exists — see below).

## Getting started

1. Start the backend (from `../server`): `docker compose up -d` for Postgres/MinIO, then
   `dotnet run --project StudyPlatform.API`.

2. Configure the app:

   ```bash
   cp .env.example .env
   ```

   | Variable | Purpose |
   | --- | --- |
   | `EXPO_PUBLIC_API_URL` | Backend base URL. `localhost` only resolves on the iOS simulator — use your machine's LAN IP on a physical device, `10.0.2.2` on the Android emulator. |
   | `EXPO_PUBLIC_GOOGLE_CLIENT_ID` / `EXPO_PUBLIC_GITHUB_CLIENT_ID` | Optional: enable "Continue with Google/GitHub". Register the `rn://oauth-redirect` redirect URI in the provider console. |
   | `EXPO_PUBLIC_SHARE_BASE_URL` | Web-app origin used to build `…/share/{token}` links (the share page only exists on web). Falls back to `EXPO_PUBLIC_API_URL`. |

3. Install and run:

   ```bash
   npm install
   npx expo start        # then i for iOS simulator, a for Android
   ```

   The app runs in [Expo Go](https://expo.dev/go); no dev build is required for any current feature.

## Project layout

```
src/
  app/          expo-router routes: (auth), (tabs)/{home,library,study,chat,settings,summarizer},
                and a root-level share/[token] route (public, outside the auth guard)
  components/   shared UI + per-feature folders (chat, quiz, study, groups, settings, …)
  services/     one API client module per backend area; apiClient.ts handles auth/refresh
  hooks/        useStudyTimer, useDictation, useTts, useChatAttachments, …
  constants/    theme tokens (ported from web/src/index.css), env, source registries
  utils/        pure helpers, most ported verbatim from web/src/utils
  vendor/       vendored markmap/d3 bundles for the mind-map WebView
```

Conventions worth knowing before changing code:

- **Expo SDK 57 changed a lot** (native tabs, `expo-video`/`expo-audio` replacing `expo-av`).
  Check <https://docs.expo.dev/versions/v57.0.0/> before using an unfamiliar Expo API.
- Auth: the app sends `X-Client-Type: mobile`, receives the refresh token in the response body
  (no cookie jar), and stores tokens in `expo-secure-store`. The refresh token rotates on every
  refresh — always overwrite the stored one.
- Heavy web libraries (pdf.js, KaTeX, markmap, tiptap-equivalent editing) run inside WebViews;
  see `src/utils/*Html.ts` for the generated documents.
- Web parity is the default: `utils/` and `constants/` modules are ports of their `web/src`
  counterparts and should be kept in sync when the web versions change.

## Checks

```bash
npx tsc --noEmit                                  # typecheck
npx expo lint                                     # ESLint (see note below)
npx expo export --platform ios --platform android # verify the bundle builds
```

Known benign noise: `expo lint` reports ~20 errors from the experimental React Compiler
`set-state-in-effect` rule on ordinary fetch-on-mount effects — confirmed non-functional; don't
contort working code to silence them. Plain `expo export` (which includes web) fails on
`react-native-youtube-iframe`; export for iOS/Android explicitly instead.

## Remote push (dormant)

Local daily reminders work everywhere, including Expo Go. Remote due-card push is fully wired
(device tokens register into the backend's `UserPushSubscriptions`; the server delivers via Expo's
push API) but requires an EAS project id and a development or store build — Expo Go and simulators
can't receive remote push. Creating the EAS build is the only missing step, and it would also unlock
the next batch of native features (share-sheet intake, widgets, quick actions).
