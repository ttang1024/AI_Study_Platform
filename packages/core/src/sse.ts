/**
 * Shared SSE parsing for the AI streaming endpoints. The backend frames
 * responses as `data: <json-encoded string>\n\n` lines terminated by
 * `data: [DONE]`; a mid-stream failure arrives as a `data: "[ERROR] <code>"`
 * chunk still followed by `[DONE]`. Transport stays per-platform (web fetch,
 * expo/fetch, extension apiFetch — they differ in auth/AI header plumbing);
 * this module owns only the byte-stream → chunk parsing they all triplicate.
 */

export const STREAM_ERROR_MESSAGE = "I'm sorry, I encountered an error. Please try again.";

export type StreamError = Error & { errorCode?: string };

export function makeStreamError(errorCode?: string): StreamError {
  const error = new Error(errorCode || STREAM_ERROR_MESSAGE) as StreamError;
  error.errorCode = errorCode;
  return error;
}

/**
 * Pull the `errorCode` (or PascalCase `ErrorCode`) off a failed response body,
 * tolerating non-JSON bodies. Pass `response` before consuming its stream.
 */
export async function extractStreamErrorCode(response: {
  json(): Promise<unknown>;
}): Promise<string | undefined> {
  try {
    const body = (await response.json()) as Record<string, unknown> | null;
    const code = body?.errorCode ?? body?.ErrorCode;
    if (typeof code === 'string' && code.trim()) return code;
  } catch {
    // Server did not return JSON — no code to extract.
  }
  return undefined;
}

// Structural subset of ReadableStream<Uint8Array> so this file typechecks under
// tsconfigs without DOM lib (RN/Metro).
export interface ByteStreamReader {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
}
export interface ByteStream {
  getReader(): ByteStreamReader;
}

/**
 * Async-iterate the raw `data:` payload strings of an SSE byte stream
 * (buffering across reads, trimming the trailing `\r`). Yields every payload
 * including the literal `[DONE]` — semantics stay with the caller.
 */
export async function* readSseData(body: ByteStream): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      yield line.slice(5).replace(/^ /, '').trim();
    }
  }
}

/**
 * Standard client semantics over `readSseData`: JSON-decode each chunk, invoke
 * `onChunk` per text chunk, return at `[DONE]`, throw a `StreamError` on an
 * `[ERROR]` chunk. `yieldBetweenChunks` inserts a macrotask between chunks so
 * React can render each one incrementally (web uses this; RN does not).
 */
export async function readSseTextStream(
  body: ByteStream,
  onChunk: (chunk: string) => void,
  opts: { yieldBetweenChunks?: boolean } = {},
): Promise<void> {
  for await (const data of readSseData(body)) {
    if (data === '[DONE]') return;
    if (!data) continue;
    let text: string;
    try {
      text = JSON.parse(data);
    } catch {
      continue; // ignore malformed frames, matching the historical behavior
    }
    if (text.startsWith('[ERROR]')) {
      throw makeStreamError(text.slice(7).trim() || undefined);
    }
    onChunk(text);
    if (opts.yieldBetweenChunks) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  }
}
