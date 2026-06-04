import { apiClient } from './apiClient';
import { ttsSettingsService } from './ttsSettingsService';

const MAX_CHUNK = 5000;

function splitIntoChunks(text: string): string[] {
  if (text.length <= MAX_CHUNK) return [text];

  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > MAX_CHUNK) {
    const slice = remaining.slice(0, MAX_CHUNK);
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

export async function synthesizeSpeech(
  text: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const voice = ttsSettingsService.getVoice();
  const chunks = splitIntoChunks(text);

  return Promise.all(
    chunks.map(async (chunk) => {
      const response = await apiClient.post<Blob>(
        '/api/tts/synthesize',
        { text: chunk, voice },
        { responseType: 'blob', signal },
      );
      return URL.createObjectURL(response.data);
    }),
  );
}

// Synthesize text into a single MP3 Blob. Long text is split into chunks that
// are stitched back together — MP3 frames concatenate cleanly for playback.
export async function synthesizeToBlob(
  text: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const voice = ttsSettingsService.getVoice();
  const chunks = splitIntoChunks(text);

  const parts = await Promise.all(
    chunks.map(async (chunk) => {
      const response = await apiClient.post<Blob>(
        '/api/tts/synthesize',
        { text: chunk, voice },
        { responseType: 'blob', signal },
      );
      return response.data;
    }),
  );

  return new Blob(parts, { type: 'audio/mpeg' });
}

export function downloadAudioBlob(blob: Blob, fileName: string): void {
  const safeName = fileName.toLowerCase().endsWith('.mp3') ? fileName : `${fileName}.mp3`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
