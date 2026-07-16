import { fetch as expoFetch } from 'expo/fetch';

import {
  STREAM_ERROR_MESSAGE,
  extractStreamErrorCode,
  makeStreamError,
  readSseTextStream,
} from '@core/sse';
import { API_URL } from '@/constants/env';
import { aiSettingsService } from '@/services/aiSettingsService';
import { tokenStore } from '@/services/tokenStore';

export { STREAM_ERROR_MESSAGE };
export type { StreamError } from '@core/sse';

/**
 * RN transport for the shared SSE reader (@core/sse). Uses `expo/fetch` (not
 * axios) because it's the only fetch in this app whose `response.body` is a
 * real streamable `ReadableStream`.
 */
export async function streamSse(
  url: string,
  body: unknown,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  // expo/fetch bypasses the axios apiClient, so the request interceptor that
  // normally injects auth + AI credentials never runs here — attach them by hand.
  // Without the X-AI-* headers the server can't run any AI work for this request
  // (summary/chat generation, and the Whisper transcript fallback), which surfaces
  // as spurious failures like NO_TRANSCRIPT even when captions could be produced.
  const [token, provider, key, model] = await Promise.all([
    tokenStore.getAccessToken(),
    aiSettingsService.getActiveProvider(),
    aiSettingsService.getActiveKey(),
    aiSettingsService.getActiveModel(),
  ]);
  const response = await expoFetch(`${API_URL}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Type': 'mobile',
      'X-AI-Provider': provider,
      'X-AI-Model': model,
      ...(key ? { 'X-AI-Key': key } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw makeStreamError(await extractStreamErrorCode(response));
  }

  await readSseTextStream(response.body!, onChunk);
}
