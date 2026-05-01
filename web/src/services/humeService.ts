import { ttsSettingsService } from './ttsSettingsService';

const MAX_CHUNK = 4800; // Hume limit is 5000; leave a small margin

/** Split text into chunks ≤ MAX_CHUNK characters, breaking at sentence boundaries. */
function splitIntoChunks(text: string): string[] {
  if (text.length <= MAX_CHUNK) return [text];

  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > MAX_CHUNK) {
    const slice = remaining.slice(0, MAX_CHUNK);
    // Prefer splitting at a sentence-ending punctuation followed by whitespace
    const cut = Math.max(
      slice.lastIndexOf('. '),
      slice.lastIndexOf('.\n'),
      slice.lastIndexOf('! '),
      slice.lastIndexOf('? '),
    );
    const splitAt = cut > 0 ? cut + 1 : MAX_CHUNK;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

export type HumeTtsErrorCode = 'zero_credits' | 'api_error';

export class HumeTtsError extends Error {
  constructor(public readonly code: HumeTtsErrorCode, message: string) {
    super(message);
    this.name = 'HumeTtsError';
  }
}

/** Synthesize a single chunk via the Hume TTS REST API and return a blob URL. */
async function synthesizeChunk(
  text: string,
  apiKey: string,
  voice: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch('https://api.hume.ai/v0/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hume-Api-Key': apiKey,
    },
    body: JSON.stringify({
      utterances: [{ text, voice: { name: voice, provider: 'HUME_AI' } }],
      format: { type: 'mp3' },
    }),
    signal,
  });

  if (!response.ok) {
    let code: HumeTtsErrorCode = 'api_error';
    let message = `TTS error (${response.status})`;
    try {
      const body = await response.json();
      const slug: string | undefined = body?.details?.slug;
      if (slug === 'zero_credits') {
        code = 'zero_credits';
        message = 'Exhausted Hume credit balance. Visit platform.hume.ai/billing to manage your account.';
      } else {
        message = body?.details?.message ?? body?.message ?? message;
      }
    } catch { /* use defaults */ }
    throw new HumeTtsError(code, message);
  }

  const data = await response.json();
  const base64 = data.generations?.[0]?.audio as string | undefined;
  if (!base64) throw new Error('Hume TTS: no audio in response');

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
}

/**
 * Synthesize speech for arbitrary-length text using the Hume TTS REST API.
 * Text longer than 4800 characters is automatically split at sentence
 * boundaries and fetched in parallel. Returns an ordered array of blob URLs;
 * the caller is responsible for revoking them.
 *
 * Note: @humeai/voice-react is for EVI (real-time voice chat) and cannot
 * speak arbitrary text. Hume TTS is a separate REST endpoint.
 */
export async function synthesizeSpeech(
  text: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const apiKey = ttsSettingsService.getHumeApiKey();
  const voice = ttsSettingsService.getVoice();
  const chunks = splitIntoChunks(text);
  return Promise.all(chunks.map(chunk => synthesizeChunk(chunk, apiKey, voice, signal)));
}
