// Shape, storage key, default voice, and voice resolution are shared with rn/ via
// packages/core; only the storage is per-platform (localStorage vs expo-secure-store).
import { TTS_SETTINGS_STORAGE_KEY, parseTtsSettings, resolveVoice } from '@core/settings';
export type { TtsSettings } from '@core/settings';
import type { TtsSettings } from '@core/settings';

export const ttsSettingsService = {
  load(): TtsSettings {
    try {
      return parseTtsSettings(localStorage.getItem(TTS_SETTINGS_STORAGE_KEY));
    } catch {
      return parseTtsSettings(null);
    }
  },

  save(settings: TtsSettings): void {
    localStorage.setItem(TTS_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  },

  getVoice(): string {
    return resolveVoice(ttsSettingsService.load());
  },
};
