import { fetch as expoFetch } from 'expo/fetch';

import { API_URL } from '@/constants/env';
import { tokenStore } from '@/services/tokenStore';

export const STREAM_ERROR_MESSAGE = "I'm sorry, I encountered an error. Please try again.";

export type StreamError = Error & { errorCode?: string };

/**
 * Ports web/src/services/streamSse.ts to React Native. Chunks arrive as
 * `data: "<json-escaped text>"\n\n`, terminated by the literal `data: [DONE]\n\n`;
 * a mid-stream failure arrives as `data: "[ERROR] <message>"\n\n` still followed
 * by `[DONE]`. Uses `expo/fetch` (not axios) because it's the only fetch in this
 * app whose `response.body` is a real streamable `ReadableStream`.
 */
export async function streamSse(
  url: string,
  body: unknown,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = await tokenStore.getAccessToken();
  const response = await expoFetch(`${API_URL}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Type': 'mobile',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let errorCode: string | undefined;
    try {
      const errorBody = await response.json();
      if (typeof errorBody?.errorCode === 'string' && errorBody.errorCode.trim()) {
        errorCode = errorBody.errorCode;
      } else if (typeof errorBody?.ErrorCode === 'string' && errorBody.ErrorCode.trim()) {
        errorCode = errorBody.ErrorCode;
      }
    } catch {
      // Fall back to the generic message if the server didn't return JSON.
    }
    const error = new Error(errorCode || STREAM_ERROR_MESSAGE) as StreamError;
    error.errorCode = errorCode;
    throw error;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;
      if (!data) continue;
      try {
        const text: string = JSON.parse(data);
        if (text.startsWith('[ERROR]')) {
          const error = new Error(STREAM_ERROR_MESSAGE) as StreamError;
          error.errorCode = text.slice(8).trim() || undefined;
          throw error;
        }
        onChunk(text);
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}
