export type AIProvider = 'gemini' | 'openai' | 'claude' | 'deepseek' | 'kimi' | 'doubao' | 'grok' | 'qwen' | 'wenxin';

export interface AISettings {
  provider: AIProvider;
  keys: Partial<Record<AIProvider, string>>;
  models: Partial<Record<AIProvider, string>>;
}

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini:   'gemini-2.5-flash',
  openai:   'gpt-4o-mini',
  claude:   'claude-sonnet-4-5',
  deepseek: 'deepseek-chat',
  kimi:     'moonshot-v1-8k',
  doubao:   'doubao-pro-32k',
  grok:     'grok-3',
  qwen:     'qwen-plus',
  wenxin:   'ernie-4.0-8k',
};

const STORAGE_KEY = 'sp_ai_settings';

/** Fired on window after save() — the `storage` event only fires in other tabs. */
export const AI_SETTINGS_CHANGED_EVENT = 'sp-ai-settings-changed';

const DEFAULT_SETTINGS: AISettings = {
  provider: 'gemini',
  keys: {},
  models: {},
};

export const aiSettingsService = {
  load(): AISettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {}
    return { ...DEFAULT_SETTINGS };
  },

  save(settings: AISettings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event(AI_SETTINGS_CHANGED_EVENT));
  },

  getActiveKey(): string | undefined {
    const settings = aiSettingsService.load();
    const key = settings.keys[settings.provider]?.trim();
    return key || undefined;
  },

  getActiveProvider(): AIProvider {
    return aiSettingsService.load().provider;
  },

  getActiveModel(): string {
    const settings = aiSettingsService.load();
    const model = settings.models[settings.provider]?.trim();
    return model || DEFAULT_MODELS[settings.provider];
  },
};
