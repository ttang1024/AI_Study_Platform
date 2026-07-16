// SSE parsing lives in the shared package (packages/core); this file keeps the
// web-only transport: browser fetch plus auth + X-AI-* headers from localStorage.
import {
	STREAM_ERROR_MESSAGE,
	extractStreamErrorCode,
	makeStreamError,
	readSseTextStream,
} from '@core/sse'
import { aiSettingsService } from './aiSettingsService'
import { getApiUrl } from '../utils/env'

const API_URL = getApiUrl()
export { STREAM_ERROR_MESSAGE }
export type { StreamError } from '@core/sse'

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
		throw makeStreamError(await extractStreamErrorCode(response))
	}

	// Yield between chunks so React renders each one incrementally.
	await readSseTextStream(response.body!, onChunk, { yieldBetweenChunks: true })
}
