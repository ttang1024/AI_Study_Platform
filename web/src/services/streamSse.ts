import { aiSettingsService } from './aiSettingsService'

const API_URL = (import.meta.env.VITE_API_URL as string) ?? ''
export const STREAM_ERROR_MESSAGE = "I'm sorry, I encountered an error. Please try again."

type StreamError = Error & { errorCode?: string }

function getAuthHeaders(): Record<string, string> {
	const token = localStorage.getItem('sp_access_token')
	const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

	const provider = aiSettingsService.getActiveProvider()
	const key = aiSettingsService.getActiveKey()
	const model = aiSettingsService.getActiveModel()
	headers['X-AI-Provider'] = provider
	headers['X-AI-Model'] = model
	if (key) headers['X-AI-Key'] = key

	return headers
}

/**
 * POST to an SSE endpoint and call onChunk for each text chunk received.
 * Chunks are JSON-serialized strings sent as `data: "..."\n\n`.
 * The stream ends with `data: [DONE]\n\n`.
 */
export async function streamSse(
	url: string,
	body: unknown,
	onChunk: (chunk: string) => void,
	signal?: AbortSignal,
): Promise<void> {
	const response = await fetch(`${API_URL}${url}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...getAuthHeaders(),
		},
		body: JSON.stringify(body),
		signal,
	})

	if (!response.ok) {
		let errorCode: string | undefined
		try {
			const errorBody = await response.json()
			if (typeof errorBody?.errorCode === 'string' && errorBody.errorCode.trim()) {
				errorCode = errorBody.errorCode
			} else if (typeof errorBody?.ErrorCode === 'string' && errorBody.ErrorCode.trim()) {
				errorCode = errorBody.ErrorCode
			}
		} catch {
			// Fall back to the status text if the server did not return JSON.
		}
		console.log('errorCode:', errorCode)
		const error = new Error(errorCode || STREAM_ERROR_MESSAGE) as StreamError
		error.errorCode = errorCode
		throw error
	}

	const reader = response.body!.getReader()
	const decoder = new TextDecoder()
	let buffer = ''

	while (true) {
		const { done, value } = await reader.read()
		if (done) break
		buffer += decoder.decode(value, { stream: true })
		const lines = buffer.split('\n')
		buffer = lines.pop() ?? ''
		for (const line of lines) {
			if (!line.startsWith('data: ')) continue
			const data = line.slice(6).trim()
			if (data === '[DONE]') return
			if (!data) continue
			try {
				const text: string = JSON.parse(data)
				if (text.startsWith('[ERROR]')) {
					const error = new Error(STREAM_ERROR_MESSAGE) as StreamError
					error.errorCode = text.slice(8).trim() || undefined
					throw error
				}
				onChunk(text)
			} catch (e) {
				if (e instanceof SyntaxError) continue
				throw e
			}
			// Yield to the event loop so React renders each chunk incrementally
			await new Promise<void>(resolve => setTimeout(resolve, 0))
		}
	}
}
