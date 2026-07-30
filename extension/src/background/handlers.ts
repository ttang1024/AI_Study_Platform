// One-shot, request/response message handlers: status, captions, chat, and the
// open-app / clip-page tab actions. Streaming (summary/mind map) lives in
// ./streaming; library reads live in ./library.

import { apiFetch } from './api'
import { ensureToken } from './auth'
import { getAiSettings, getConfig } from './config'
import { tokenEmail } from './jwt'
import { ensureVideo, extractYouTubeId } from './library'

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

/** Collects a `data:` SSE stream (the StreamAiToSseAsync format) into the full reply text. */
async function readSseText(res: Response): Promise<{ ok: boolean; text?: string; error?: string }> {
	const reader = res.body!.getReader()
	const decoder = new TextDecoder()
	let buffer = ''
	let out = ''
	for (;;) {
		const { value, done } = await reader.read()
		if (done) break
		buffer += decoder.decode(value, { stream: true })
		let nl: number
		while ((nl = buffer.indexOf('\n')) >= 0) {
			const line = buffer.slice(0, nl).replace(/\r$/, '')
			buffer = buffer.slice(nl + 1)
			if (!line.startsWith('data:')) continue
			const data = line.slice(5).replace(/^ /, '')
			if (data === '[DONE]') return { ok: true, text: out }
			let chunk: any = data
			try {
				chunk = JSON.parse(data) // chunks are JSON-encoded strings
			} catch {
				/* keep raw */
			}
			if (typeof chunk === 'string' && chunk.startsWith('[ERROR]')) return { ok: false, error: chunk.slice(7).trim() }
			if (typeof chunk === 'string') out += chunk
		}
	}
	return { ok: true, text: out }
}

export async function handleChat(msg: {
	videoUrl: string
	message: string
	history?: any[]
	attachments?: { mimeType: string; data: string; fileName?: string }[]
	conversationId?: string | null
}) {
	// Save the video to the library (like Summary does) so the conversation is
	// persisted and shows up on the web app's video page. The persisting stream
	// endpoint loads history from the DB, so we don't send the local copy.
	const ytId = extractYouTubeId(msg.videoUrl)
	const savedId = ytId ? await ensureVideo(ytId, msg.videoUrl).catch(() => null) : null

	if (savedId) {
		// No thread yet (fresh "New chat") → create one so this turn starts it.
		let conversationId = msg.conversationId || null
		if (!conversationId) {
			const createRes = await apiFetch(`/api/videos/${savedId}/chat/conversations`, { method: 'POST', body: {} })
			const createBody = await createRes.json().catch(() => null)
			conversationId = createBody?.data?.conversationId ?? null
		}

		const res = await apiFetch(`/api/videos/${savedId}/chat/stream`, {
			method: 'POST',
			ai: true,
			body: {
				message: msg.message,
				attachments: msg.attachments || [],
				...(conversationId ? { conversationId } : {}),
			},
		})
		const ctype = res.headers.get('content-type') || ''
		if (!res.ok || !ctype.includes('text/event-stream')) {
			const body = await res.json().catch(() => null)
			return { ok: false, error: body?.message || 'Chat failed.', code: body?.errorCode }
		}
		const sse = await readSseText(res)
		if (!sse.ok) return { ok: false, error: sse.error || 'Chat failed.' }
		return { ok: true, reply: sse.text || '', conversationId }
	}

	// Couldn't save (e.g. library call failed) — fall back to the stateless endpoint.
	const res = await apiFetch('/api/videos/chat', {
		method: 'POST',
		ai: true,
		body: {
			videoUrl: msg.videoUrl,
			message: msg.message,
			history: msg.history || [],
			attachments: msg.attachments || [],
		},
	})
	const body = await res.json().catch(() => null)
	if (!res.ok) return { ok: false, error: body?.message || 'Chat failed.', code: body?.errorCode }
	return { ok: true, reply: body?.data || '' }
}

/** Screenshot fallback when the page's <video> frame can't be canvas-captured. */
export async function handleCaptureTab(windowId?: number) {
	try {
		const dataUrl = await chrome.tabs.captureVisibleTab(windowId ?? chrome.windows.WINDOW_ID_CURRENT, {
			format: 'jpeg',
			quality: 85,
		})
		return { ok: true, dataUrl }
	} catch (e) {
		return { ok: false, error: String((e as Error)?.message || e) }
	}
}

export async function handleOpenApp(path: string) {
	const { appOrigin } = await getConfig()
	await chrome.tabs.create({ url: `${appOrigin}${path || '/'}` })
	return { ok: true }
}

export async function handleClip(url: string) {
	const { appOrigin } = await getConfig()
	await chrome.tabs.create({ url: `${appOrigin}/library/add?tab=web&clip=${encodeURIComponent(url)}` })
	return { ok: true }
}

/** Highlight → flashcard: selection becomes the front, the AI writes the back. */
export async function handleSaveFlashcard(text: string, sourceTitle?: string, sourceUrl?: string) {
	const res = await apiFetch('/api/flashcards/from-text', {
		method: 'POST',
		ai: true,
		body: { text, sourceTitle: sourceTitle || null, sourceUrl: sourceUrl || null },
	})
	const body = await res.json().catch(() => null)
	if (!res.ok) return { ok: false, error: body?.message || 'Couldn’t save the flashcard.', code: body?.errorCode }
	return { ok: true, card: body?.data || null }
}
