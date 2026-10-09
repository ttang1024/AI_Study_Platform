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
import { getAccessToken, refreshAccessToken } from './accessToken'

const API_URL = getApiUrl()
export { STREAM_ERROR_MESSAGE }
export type { StreamError } from '@core/sse'

function getAuthHeaders(): Record<string, string> {
	const token = getAccessToken()
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
	const send = () =>
		fetch(`${API_URL}${url}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...getAuthHeaders(),
			},
			body: JSON.stringify(body),
			signal,
		})

	let response = await send()
	// The access token is short-lived and memory-only; an expired one is re-minted from the refresh
	// cookie once, the same way apiClient's interceptor does for ordinary requests.
	if (response.status === 401) {
		try {
			await refreshAccessToken()
			response = await send()
		} catch {
			// Fall through: the original 401 is reported below.
		}
	}

	if (!response.ok) {
		throw makeStreamError(await extractStreamErrorCode(response))
	}

	// Yield between chunks so React renders each one incrementally.
	await readSseTextStream(response.body!, onChunk, { yieldBetweenChunks: true })
}
