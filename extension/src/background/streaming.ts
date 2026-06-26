// Streaming text (summary, mind map) over a long-lived runtime port. The worker
// saves the video first so it can stream the persisting `{id}/…/stream` endpoint
// and write the result to the DB, parsing the SSE `data:` frames into chunks.

import { apiFetch, friendlyError } from './api'
import { ensureVideo, extractYouTubeId } from './library'

export async function startStream(kind: string, videoUrl: string, port: chrome.runtime.Port, signal: AbortSignal) {
	const videoId = extractYouTubeId(videoUrl)
	const id = videoId ? await ensureVideo(videoId, videoUrl) : null
	if (signal.aborted) return
	// Persisting endpoint when saved; otherwise the anonymous URL endpoint.
	if (id) streamSse(`/api/videos/${id}/${kind}/stream`, undefined, port, signal)
	else streamSse(`/api/videos/${kind}/stream`, { videoUrl }, port, signal)
}

async function streamSse(path: string, body: any, port: chrome.runtime.Port, signal: AbortSignal) {
	const post = (m: any) => {
		try {
			port.postMessage(m)
		} catch {
			/* port closed */
		}
	}
	let res: Response
	try {
		res = await apiFetch(path, { method: 'POST', ai: true, body, signal })
	} catch (e) {
		return post({ type: 'error', ...friendlyError(e) })
	}

	const ctype = res.headers.get('content-type') || ''
	if (!res.ok && !ctype.includes('text/event-stream')) {
		const body = await res.json().catch(() => null)
		return post({ type: 'error', error: body?.message || `Request failed (${res.status}).`, code: body?.errorCode })
	}

	// Parse SSE: lines of `data: <json-chunk>`, terminated by `data: [DONE]`.
	const reader = res.body!.getReader()
	const decoder = new TextDecoder()
	let buffer = ''
	try {
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
				if (data === '[DONE]') return post({ type: 'done' })
				let text: any = data
				try {
					text = JSON.parse(data) // chunks are JSON-encoded strings
				} catch {
					/* keep raw */
				}
				if (typeof text === 'string' && text.startsWith('[ERROR]'))
					return post({ type: 'error', error: text.slice(7).trim() })
				post({ type: 'chunk', text })
			}
		}
		post({ type: 'done' })
	} catch (e: any) {
		if (signal.aborted) return
		post({ type: 'error', error: e?.message || 'Stream interrupted.' })
	}
}
