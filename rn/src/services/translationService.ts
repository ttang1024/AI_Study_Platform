import { apiClient } from '@/services/apiClient';

/**
 * On-demand translation of generated study material. Nothing is stored: a translation is a view of
 * the material, not a second copy, and a stored one would drift when the source is regenerated.
 */
export const translationService = {
  async translate(text: string, targetLanguage: string): Promise<string> {
    const res = await apiClient.post('/api/ai/translate', { text, targetLanguage });
    return res.data.data as string;
  },
};

export default translationService;
