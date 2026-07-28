import type { HttpClient } from '../http';

/**
 * Language mode: on-demand translation of generated material, and sentence
 * mining (a sentence you met becomes a cloze card in the normal FSRS schedule).
 *
 * Pronunciation scoring is deliberately absent: it posts a recording, and web
 * and rn build that multipart body from different primitives (a Blob from
 * MediaRecorder vs. a file URI from expo-audio), which the HttpClient seam has
 * no opinion about. Only its result types are shared, so both render the same
 * scorecard.
 */
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

export interface MineSentenceInput {
  sentence: string;
  targetWord: string;
  meaning?: string;
  documentId?: string;
  videoId?: string;
}

export function createLanguageService(http: HttpClient) {
  return {
    /**
     * Nothing is stored: a translation is a view of the material, not a second
     * copy, and a stored one would drift when the source is regenerated.
     */
    async translate(text: string, targetLanguage: string): Promise<string> {
      const res = await http.post<{ data: string }>('/api/ai/translate', { text, targetLanguage });
      return res.data.data;
    },

    /** Creates a cloze flashcard, which then enters the ordinary FSRS review schedule. */
    async mineSentence(input: MineSentenceInput): Promise<string> {
      const res = await http.post<{ data: string }>('/api/language/mine', input);
      return res.data.data;
    },
  };
}

export type LanguageService = ReturnType<typeof createLanguageService>;
