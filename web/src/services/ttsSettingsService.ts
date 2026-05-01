const STORAGE_KEY = 'sp_tts_settings';

export interface TtsSettings {
  humeApiKey: string;
  voice: string;
}

const DEFAULTS: TtsSettings = {
  humeApiKey: '',
  voice: 'ITO',
};

export const ttsSettingsService = {
  load(): TtsSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {}
    return { ...DEFAULTS };
  },

  save(settings: TtsSettings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  },

  getHumeApiKey(): string {
    return ttsSettingsService.load().humeApiKey.trim();
  },

  getVoice(): string {
    return ttsSettingsService.load().voice.trim() || DEFAULTS.voice;
  },
};
