import type { HttpClient } from '../http';

/** On-demand translation of generated material. */
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
  };
}

