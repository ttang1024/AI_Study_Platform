// Authenticated fetch against the Easy Study API. Attaches the Bearer token and
// the X-AI-* provider headers, retries once after a token refresh on 401, and
// maps auth failures to friendly messages for the panel.

import { buildAiHeaders } from '@core/ai'
import { getAiSettings, getConfig } from './config'
import { ensureToken, refreshAccessToken } from './auth'

export class AuthError {
	constructor(public code: 'NOT_SIGNED_IN' | 'NO_AI') {}
}

async function buildHeaders(opts: { auth: boolean; ai: boolean; json: boolean }): Promise<Record<string, string>> {
	const headers: Record<string, string> = {}
	if (opts.json) headers['Content-Type'] = 'application/json'
	if (opts.auth) {
		const token = await ensureToken()
		if (!token) throw new AuthError('NOT_SIGNED_IN')
		headers.Authorization = `Bearer ${token}`
	}
	if (opts.ai) {
		const settings = await getAiSettings()
		if (!settings) throw new AuthError('NO_AI')
		Object.assign(headers, buildAiHeaders(settings))
	}
	return headers
}

export interface FetchOpts {
	method?: string
	body?: any
	auth?: boolean
	ai?: boolean
	signal?: AbortSignal
}

// fetch with Bearer; retries once after a refresh on 401.
export async function apiFetch(path: string, opts: FetchOpts = {}): Promise<Response> {
	const { method = 'GET', body, auth = true, ai = false, signal } = opts
	const { apiOrigin } = await getConfig()
	const json = body !== undefined
	const doFetch = async () => {
		const headers = await buildHeaders({ auth, ai, json })
		return fetch(`${apiOrigin}${path}`, {
			method,
			headers,
			credentials: 'include',
			body: json ? JSON.stringify(body) : undefined,
			signal,
		})
	}
	let res = await doFetch()
	if (res.status === 401 && auth) {
		if (await refreshAccessToken()) res = await doFetch()
	}
	return res
}

export function friendlyError(e: any) {
	if (e instanceof AuthError && e.code === 'NOT_SIGNED_IN')
		return { ok: false, error: 'Not signed in. Open Easy Study and log in.', code: 'NOT_SIGNED_IN' }
	if (e instanceof AuthError && e.code === 'NO_AI')
		return { ok: false, error: 'No AI provider configured. Set one up in Easy Study → Settings → AI Services.', code: 'NO_AI' }
	return { ok: false, error: e?.message || String(e) }
}
