// Minimal JWT inspection — we only need expiry and the user's email/subject for
// the status read-out. No signature verification; the API is the source of truth.

function decodeJwt(token: string): Record<string, any> | null {
	try {
		const payload = token.split('.')[1]
		const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
		return JSON.parse(json)
	} catch {
		return null
	}
}

export function tokenExpired(token: string): boolean {
	const claims = decodeJwt(token)
	if (!claims || !claims.exp) return true
	return Date.now() / 1000 >= claims.exp - 30 // 30s skew
}

export function tokenEmail(token: string): string | null {
	const c = decodeJwt(token) || {}
	return (
		c.email ||
		c.unique_name ||
		c.sub ||
		c['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
		null
	)
}
