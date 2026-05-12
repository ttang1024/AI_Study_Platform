const STORAGE_KEY = 'sp_tts_settings';

export interface TtsSettings {
  voice: string;
}

const DEFAULTS: TtsSettings = {
  voice: 'en-US-AriaNeural',
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

  getVoice(): string {
    return ttsSettingsService.load().voice.trim() || DEFAULTS.voice;
  },
};
