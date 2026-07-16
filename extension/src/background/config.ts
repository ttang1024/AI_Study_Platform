// Service-worker configuration and chrome.storage-backed state.
//
// Holds the API/app origins, the synced access token, and the synced AI
// provider settings — everything the worker reads from chrome.storage.local.

import { DEFAULT_MODELS, type ResolvedAiSettings } from '@core/ai'

export const DEFAULTS = {
	apiOrigin: 'http://localhost:5001',
	appOrigin: 'http://localhost:3000',
}

// The provider→model defaults and the resolved trio shape are shared across
// web/, rn/, and extension/ (see packages/core/src/ai.ts).
const MODELS = DEFAULT_MODELS as Record<string, string>

export type AiSettings = ResolvedAiSettings

export async function getConfig() {
	const s = await chrome.storage.local.get(['apiOrigin', 'appOrigin'])
	return {
		apiOrigin: (s.apiOrigin || DEFAULTS.apiOrigin).replace(/\/+$/, ''),
		appOrigin: (s.appOrigin || DEFAULTS.appOrigin).replace(/\/+$/, ''),
	}
}

export async function getToken(): Promise<string | null> {
	const { es_token } = await chrome.storage.local.get('es_token')
	return es_token || null
}

export async function setToken(token: string | null) {
	await chrome.storage.local.set({ es_token: token || '' })
}

export async function setAiSettings(ai: unknown) {
	await chrome.storage.local.set({ es_ai: ai })
}

export async function getAiSettings(): Promise<AiSettings | null> {
	const { es_ai } = await chrome.storage.local.get('es_ai')
	if (!es_ai || !es_ai.provider) return null
	const provider = es_ai.provider
	const model = (es_ai.model && es_ai.model.trim()) || MODELS[provider] || ''
	const key = (es_ai.key || '').trim()
	return { provider, model, key }
}
