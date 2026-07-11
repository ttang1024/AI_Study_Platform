import * as SecureStore from 'expo-secure-store';

export interface TtsSettings {
  voice: string;
}

const STORAGE_KEY = 'sp_tts_settings';

const DEFAULTS: TtsSettings = {
  voice: 'en-US-AriaNeural',
};

// Mirrors web/src/services/ttsSettingsService.ts, swapping localStorage for
// expo-secure-store (async) per the aiSettingsService.ts convention.
export const ttsSettingsService = {
  async load(): Promise<TtsSettings> {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {}
    return { ...DEFAULTS };
  },

  async save(settings: TtsSettings): Promise<void> {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(settings));
  },

  async getVoice(): Promise<string> {
    const settings = await ttsSettingsService.load();
    return settings.voice.trim() || DEFAULTS.voice;
  },
};
