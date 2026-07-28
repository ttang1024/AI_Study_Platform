import { createLanguageService, type PronunciationResult } from '@core/services/languageService';
import { apiClient } from '@/services/apiClient';
import { http } from '@/services/http';

export type { PronunciationResult, WordScore } from '@core/services/languageService';

const core = createLanguageService(http);

/**
 * `mineSentence` is shared with web via packages/core. `scorePronunciation` is not:
 * it posts a recording, and web and rn build that multipart body from different
 * primitives (a Blob from MediaRecorder vs. a file URI from expo-audio). The shared
 * HttpClient seam deliberately has no opinion about either, so the upload stays here
 * and only the result types are shared.
 */
export const languageService = {
  /** `audio` is a local file URI from the recorder. */
  async scorePronunciation(audioUri: string, targetPhrase: string): Promise<PronunciationResult> {
    const form = new FormData();
    form.append('audio', {
      uri: audioUri,
      // The recorder writes m4a on both platforms; the server hands the bytes to Whisper, which
      // sniffs the container rather than trusting this.
      name: 'attempt.m4a',
      type: 'audio/m4a',
    } as unknown as Blob);
    form.append('targetPhrase', targetPhrase);

    const res = await apiClient.post('/api/language/pronunciation', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data as PronunciationResult;
  },

  /** Creates a cloze flashcard, which then enters the ordinary FSRS review schedule. */
  mineSentence: core.mineSentence,
};

export default languageService;
