// Service-worker configuration and chrome.storage-backed state.
//
// Holds the API/app origins, the synced access token, and the synced AI
// provider settings — everything the worker reads from chrome.storage.local.

export const DEFAULTS = {
	apiOrigin: 'http://localhost:5001',
	appOrigin: 'http://localhost:3000',
}

const DEFAULT_MODELS: Record<string, string> = {
	gemini: 'gemini-2.5-flash',
	openai: 'gpt-4o-mini',
	claude: 'claude-sonnet-4-5',
	deepseek: 'deepseek-chat',
	kimi: 'moonshot-v1-8k',
	doubao: 'doubao-pro-32k',
	grok: 'grok-3',
	qwen: 'qwen-plus',
	wenxin: 'ernie-4.0-8k',
}

export interface AiSettings {
	provider: string
	model: string
	key: string
}

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
	const model = (es_ai.model && es_ai.model.trim()) || DEFAULT_MODELS[provider] || ''
	const key = (es_ai.key || '').trim()
	return { provider, model, key }
}
