/// <reference types="vite/client" />

// The admin dashboard is served as a static site from its own origin (admin.<domain>), so unlike the
// dev server — which proxies /api to localhost:5001 — there is nothing on that origin to answer /api.
// VITE_API_URL is baked in at build time by deploy.sh and points at the API origin; when it is empty
// (local `npm run dev`) the base URL collapses back to a same-origin /api for the Vite proxy.
export const getApiBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '') ?? '';
  return `${apiUrl}/api`;
};
