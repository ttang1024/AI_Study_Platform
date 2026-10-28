/**
 * Whether a JWT's `exp` falls within `seconds` from now — or the token can't be read, which is treated
 * the same way, so the caller refreshes rather than presenting a token the server will refuse.
 *
 * Only reads the claim; verifying the signature is the server's job. Used where a token is handed to
 * something that cannot retry on a 401 itself: the SignalR hub reconnects with whatever its
 * accessTokenFactory returns, and the server closes hub connections when their token expires.
 */
export function jwtExpiresWithin(token: string, seconds: number, nowMs: number = Date.now()): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) return true;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const exp = (JSON.parse(atob(base64)) as { exp?: unknown }).exp;
    return typeof exp !== 'number' || exp * 1000 - nowMs <= seconds * 1000;
  } catch {
    return true;
  }
}
