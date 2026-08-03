import * as SecureStore from 'expo-secure-store';

// Shape, storage key, default voice, and voice resolution are shared with web/ via
// packages/core; only the storage is per-platform — expo-secure-store (async) here,
// per the aiSettingsService.ts convention.
import { TTS_SETTINGS_STORAGE_KEY, parseTtsSettings, resolveVoice } from '@core/settings';
import type { TtsSettings } from '@core/settings';

export type { TtsSettings } from '@core/settings';

export const ttsSettingsService = {
  async load(): Promise<TtsSettings> {
    try {
      return parseTtsSettings(await SecureStore.getItemAsync(TTS_SETTINGS_STORAGE_KEY));
    } catch {
      return parseTtsSettings(null);
    }
  },

  async save(settings: TtsSettings): Promise<void> {
    await SecureStore.setItemAsync(TTS_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  },

  async getVoice(): Promise<string> {
    return resolveVoice(await ttsSettingsService.load());
  },
};
