// Access-token lifecycle: reuse the synced token while valid, otherwise mint a
// fresh one from the HttpOnly refresh cookie on the API origin.

import { getConfig, getToken, setToken } from './config'
import { tokenExpired } from './jwt'

// Mint a fresh access token from the refresh cookie. Returns token or null.
export async function refreshAccessToken(): Promise<string | null> {
	const { apiOrigin } = await getConfig()
	try {
		const res = await fetch(`${apiOrigin}/api/auth/refresh-token`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: '{}',
		})
		if (!res.ok) return null
		const body = await res.json().catch(() => null)
		const token = body?.data?.accessToken
		if (token) {
			await setToken(token)
			return token
		}
	} catch {
		/* network/cookie missing → not signed in */
	}
	return null
}

export async function ensureToken(): Promise<string | null> {
	const token = await getToken()
	if (token && !tokenExpired(token)) return token
	return refreshAccessToken()
}
