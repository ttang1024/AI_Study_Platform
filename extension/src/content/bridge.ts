// Easy Study — auth/AI-settings bridge.
//
// Runs on the Easy Study web app origin and copies the user's access token and
// AI provider settings out of the app's localStorage into the extension, so the
// YouTube panel reuses the same login and AI keys without re-entering anything.
// Read-only: it never writes to the app, only mirrors values into the worker.

const AI_PROVIDERS = ['gemini', 'openai', 'claude', 'deepseek', 'kimi', 'doubao', 'grok', 'qwen', 'wenxin']

function readAi(): { provider: string; model: string; key: string } | null {
	try {
		const raw = localStorage.getItem('sp_ai_settings')
		if (!raw) return null
		const s = JSON.parse(raw)
		const provider = AI_PROVIDERS.includes(s.provider) ? s.provider : 'gemini'
		return {
			provider,
			model: s.models?.[provider] || '',
			key: s.keys?.[provider] || '',
		}
	} catch {
		return null
	}
}

let lastToken: string | null = null
let lastAi: string | null = null

function sync() {
	const token = localStorage.getItem('sp_access_token') || ''
	const ai = readAi()
	const aiStr = JSON.stringify(ai)
	if (token === lastToken && aiStr === lastAi) return
	lastToken = token
	lastAi = aiStr
	try {
		chrome.runtime.sendMessage({ type: 'ES_SYNC', token: token || null, ai })
	} catch {
		/* worker reloading */
	}
}

sync()
window.addEventListener('storage', (e) => {
	if (e.key === 'sp_access_token' || e.key === 'sp_ai_settings') sync()
})
// storage event doesn't fire for same-tab writes, so poll as well
setInterval(sync, 4000)
