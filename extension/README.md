# Easy Study — YouTube AI Notes (browser extension)

A **React** browser extension that adds a NoteGPT-style sidebar to any YouTube
video so you can **summarize, read the transcript, chat with the video, and take
timestamped notes** — all powered by your own Easy Study account and AI keys.
Built with **Vite + CRXJS**, so the injected UI **hot-reloads** as you edit.

> ⚠️ **Load `extension/dist/`, not this `extension/` folder.** This is a
> build-step extension — the source `manifest.json` references `.tsx`/`.ts`
> files that Chrome can't load directly. Run `npm run build` (or `npm run dev`)
> first, then **Load unpacked → `extension/dist`**. Pointing Chrome at the
> source folder gives `Invalid script mime type … can only be loaded from …
> .js files`.

## Features

- **Floating panel** on every YouTube watch page (and Shorts), rendered with
  React inside a Shadow DOM so it can't clash with YouTube's styles.
- **AI Summary** — streamed in real time from the video's transcript.
- **Transcript** — searchable, timestamped, click a line to jump the player;
  the current line highlights as the video plays.
- **Chat** — ask questions about the video; answers are grounded in its transcript.
  Messages can be copied or read aloud; the composer supports voice dictation,
  image attachments, and one-click screenshots of the current video frame.
- **Notes** — capture a thought at the current timestamp, click to jump back,
  export as Markdown. Stored locally per video.
- **Clip to library** — send the current page into your Easy Study library.

## Develop (with hot reload)

```bash
cd extension
npm install
npm run dev          # starts Vite + CRXJS on http://localhost:5173
```

Then load the **`dist/`** folder once as an unpacked extension:

1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select `extension/dist`.
3. Open a YouTube video. Edit anything under `src/` and the panel updates live —
   React components hot-swap via Fast Refresh; the background/content scripts
   auto-reload.

> Keep `npm run dev` running while developing; CRXJS rebuilds `dist/` on change.

## Build for distribution

```bash
npm run build        # outputs a production dist/
npm run typecheck    # tsc --noEmit
```

Load `dist/` as unpacked, or zip it for the Web Store.

## How it works

All network calls run in the extension's **service worker** (`src/background/`),
so they bypass page CORS. It reuses your existing Easy Study session:

- Your **access token** and **AI provider settings** are mirrored from the web
  app's local storage by a tiny read-only bridge (`src/content/bridge.ts`).
- If the token expires, the worker silently refreshes it using the app's
  HttpOnly refresh cookie.

So there are **no API keys to re-enter** — just stay logged into Easy Study, and
set an AI provider key in **Settings → AI Services**.

## Pointing at a deployment

Defaults target local dev (`app http://localhost:3000`, `api http://localhost:5001`).
For a hosted instance, click the toolbar icon → **Settings**, enter your app and
API URLs, and **Save**. You'll be prompted to grant the extension access to those
URLs; the login/AI-settings bridge is then registered for your app origin too.

## Project layout

```
src/
  background/             Service worker, split by concern:
    index.ts              Entry: chrome message router + stream port wiring
    config.ts             Origins, synced token + AI settings (chrome.storage)
    jwt.ts                JWT decode / expiry / email
    auth.ts               Token refresh + ensure-valid-token
    api.ts                Authenticated apiFetch, AI headers, error mapping
    library.ts            Find/save the video record + read saved content
    handlers.ts           status / transcript / subtitles / chat / open-app / clip
    streaming.ts          SSE summary + mind-map streaming
  content/
    youtube.tsx           Mounts the React panel into a Shadow DOM on YouTube
    Panel.tsx             Top-level panel: header, tabs, shared state
    hooks/                One hook per concern (useVideoId / useStatus /
                          useCaptions / useStreamText / useChat / useLibrary)
    panel.css             Panel styles (injected into the shadow root via ?inline)
    bridge.ts             Mirrors token + AI settings from the app origin
    components/           Banner, Markdown, SummaryMarkdown, Spinner, LoginGate
    tabs/                 SummaryTab, TranscriptTab, ChatTab
  popup/                  React toolbar popup (status, quick actions, settings)
  lib/                    messaging, markdown renderer, util
manifest.json             MV3 manifest (CRXJS resolves the src/ paths)
vite.config.ts            Vite + react() + crx()
```

Prefer no extension for clipping? Settings → Export → **Web Clipper bookmarklet**
does the page-clip part from your bookmarks bar.
