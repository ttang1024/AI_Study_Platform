import { File, Paths } from 'expo-file-system';

import { apiClient } from './apiClient';
import { ttsSettingsService } from './ttsSettingsService';
import { splitIntoSpeechChunks } from '@core/utils/textChunks';


let fileCounter = 0;

// Calls the same POST /api/tts/synthesize endpoint the web app uses (Edge TTS
// on the backend). Unlike web, RN has no Blob/ObjectURL — each chunk's MP3
// bytes are written to a temp file in the cache directory and played from
// its file:// uri (see rn/src/hooks/useTts.ts).
export async function synthesizeSpeech(text: string, signal?: AbortSignal): Promise<string[]> {
  const voice = await ttsSettingsService.getVoice();
  const chunks = splitIntoSpeechChunks(text);

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
