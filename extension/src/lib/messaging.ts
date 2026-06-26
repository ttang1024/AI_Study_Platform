// Typed wrappers around chrome messaging to the service worker.

export interface Status {
	connected: boolean
	hasAi: boolean
	provider: string | null
	email: string | null
	apiOrigin: string
	appOrigin: string
}

export interface TranscriptSegment {
	startSeconds: number
	text: string
}

export type Msg =
	| { type: 'ES_STATUS' }
	| { type: 'ES_TRANSCRIPT'; videoId: string }
	| { type: 'ES_CHAT'; videoUrl: string; message: string; history: { role: string; content: string }[] }
	| { type: 'ES_LIBRARY'; videoId: string }
	| { type: 'ES_OPEN_APP'; path: string }
	| { type: 'ES_CLIP'; url: string }

export function send<T = any>(msg: Msg): Promise<T> {
	return new Promise((resolve) => {
		try {
			chrome.runtime.sendMessage(msg, (res) => {
				if (chrome.runtime.lastError) {
					resolve({ ok: false, error: chrome.runtime.lastError.message } as T)
					return
				}
				resolve(res as T)
			})
		} catch (e) {
			resolve({ ok: false, error: String(e) } as T)
		}
	})
}

// Streamed-text messages flowing back over the long-lived port (summary, mind map).
export type SummaryEvent =
	| { type: 'chunk'; text: string }
	| { type: 'done' }
	| { type: 'error'; error: string; code?: string }

// A generic SSE port: the `start` message carries the API path so the same
// pipe powers both /summary/stream and /mindmap/stream.
export function connectStream(): chrome.runtime.Port {
	return chrome.runtime.connect({ name: 'es-stream' })
}
