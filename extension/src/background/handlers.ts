// One-shot, request/response message handlers: status, captions, chat, and the
// open-app / clip-page tab actions. Streaming (summary/mind map) lives in
// ./streaming; library reads live in ./library.

import { apiFetch } from './api'
import { ensureToken } from './auth'
import { getAiSettings, getConfig } from './config'
import { tokenEmail } from './jwt'

export async function handleStatus() {
	const cfg = await getConfig()
	const token = await ensureToken()
	const ai = await getAiSettings()
	return {
		connected: !!token,
		hasAi: !!ai,
		provider: ai?.provider || null,
		email: token ? tokenEmail(token) : null,
		...cfg,
	}
}

export async function handleTranscript(videoId: string) {
	const res = await apiFetch(`/api/videos/transcript?videoId=${encodeURIComponent(videoId)}`)
	const body = await res.json().catch(() => null)
	if (!res.ok) return { ok: false, error: body?.message || 'No captions found for this video.', code: body?.errorCode }
	return { ok: true, segments: body?.data || [] }
}

export async function handleChat(msg: { videoUrl: string; message: string; history?: any[] }) {
	const res = await apiFetch('/api/videos/chat', {
		method: 'POST',
		ai: true,
		body: { videoUrl: msg.videoUrl, message: msg.message, history: msg.history || [] },
	})
	const body = await res.json().catch(() => null)
	if (!res.ok) return { ok: false, error: body?.message || 'Chat failed.', code: body?.errorCode }
	return { ok: true, reply: body?.data || '' }
}

export async function handleOpenApp(path: string) {
	const { appOrigin } = await getConfig()
	await chrome.tabs.create({ url: `${appOrigin}${path || '/'}` })
	return { ok: true }
}

export async function handleClip(url: string) {
	const { appOrigin } = await getConfig()
	await chrome.tabs.create({ url: `${appOrigin}/summarizer?tab=web&clip=${encodeURIComponent(url)}` })
	return { ok: true }
}
