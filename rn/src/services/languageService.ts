import { apiClient } from '@/services/apiClient';

export interface WordScore {
  word: string;
  correct: boolean;
}

export interface PronunciationResult {
  targetPhrase: string;
  heard: string;
  /** 0-100: the share of target words a recogniser made out, in order. */
  score: number;
  words: WordScore[];
}

/**
 * Not in packages/core: the pronunciation call posts a recording, and web and rn build that
 * multipart body from different primitives (a Blob from MediaRecorder vs. a file URI from
 * expo-audio). The shared HttpClient seam deliberately has no opinion about either.
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
  async mineSentence(input: {
    sentence: string;
    targetWord: string;
    meaning?: string;
    documentId?: string;
    videoId?: string;
  }): Promise<string> {
    const res = await apiClient.post('/api/language/mine', input);
    return res.data.data as string;
  },
};

export default languageService;
