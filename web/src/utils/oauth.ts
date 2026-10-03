import { getPublicEnv } from './env';

// Both entry points (sign in and sign up) start the same OAuth handshake, so the client ids and
// the URL builder live here rather than being copied into each page.
export const GOOGLE_CLIENT_ID =
  getPublicEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID') ?? getPublicEnv('VITE_GOOGLE_CLIENT_ID');
export const GITHUB_CLIENT_ID =
  getPublicEnv('NEXT_PUBLIC_GITHUB_CLIENT_ID') ?? getPublicEnv('VITE_GITHUB_CLIENT_ID');

/** `state` carries the provider back to /auth/callback, which needs to know which token to swap. */
export function buildOAuthUrl(provider: 'google' | 'github'): string {
  const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
  if (provider === 'google') {
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&scope=email%20profile&response_type=code&state=google`;
  }
  return `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=read:user%20user:email&state=github`;
}
