/**
 * Backend base URL. Set EXPO_PUBLIC_API_URL in `.env` (see `.env.example`) —
 * `localhost` only resolves on the iOS simulator, so a physical device or
 * Android emulator needs your machine's LAN IP (Android emulator: 10.0.2.2).
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5001';

/**
 * OAuth client IDs for "Continue with Google/GitHub" (see .env.example). These
 * must be registered with the mobile redirect URI (`rn://oauth-redirect` in a
 * dev client / standalone build) in the respective provider's OAuth app
 * console — the code exchange itself happens server-side (see
 * server/StudyPlatform.Infrastructure/Services/OAuthService.cs).
 */
export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
export const GITHUB_CLIENT_ID = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID;

/**
 * Origin of the web app, used to build public share-page links
 * (`{SHARE_BASE_URL}/share/{token}` — the share page only exists on web).
 * Falls back to API_URL, which is only correct when the web app and API are
 * served from the same origin (e.g. behind the production reverse proxy).
 */
export const SHARE_BASE_URL = process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? API_URL;
