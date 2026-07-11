import { File, Paths } from 'expo-file-system';

import { apiClient } from './apiClient';
import { ttsSettingsService } from './ttsSettingsService';

const MAX_CHUNK = 5000;

// Mirrors web/src/services/edgeTtsService.ts's splitIntoChunks — keeps each
// request under the backend's practical text limit, cutting at sentence
// boundaries so chunk audio doesn't clip mid-sentence.
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

let fileCounter = 0;

// Calls the same POST /api/tts/synthesize endpoint the web app uses (Edge TTS
// on the backend). Unlike web, RN has no Blob/ObjectURL — each chunk's MP3
// bytes are written to a temp file in the cache directory and played from
// its file:// uri (see rn/src/hooks/useTts.ts).
export async function synthesizeSpeech(text: string, signal?: AbortSignal): Promise<string[]> {
  const voice = await ttsSettingsService.getVoice();
  const chunks = splitIntoChunks(text);

  return Promise.all(
    chunks.map(async (chunk) => {
      const response = await apiClient.post<ArrayBuffer>(
        '/api/tts/synthesize',
        { text: chunk, voice },
        { responseType: 'arraybuffer', signal },
      );
      const file = new File(Paths.cache, `tts-${Date.now()}-${fileCounter++}.mp3`);
      if (file.exists) file.delete();
      file.write(new Uint8Array(response.data));
      return file.uri;
    }),
  );
}
