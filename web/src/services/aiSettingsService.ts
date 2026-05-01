export type AIProvider = 'gemini' | 'openai' | 'claude' | 'deepseek' | 'kimi' | 'doubao' | 'grok' | 'qwen' | 'wenxin';

export interface AISettings {
  provider: AIProvider;
  keys: Partial<Record<AIProvider, string>>;
  models: Partial<Record<AIProvider, string>>;
}

export const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  gemini:   ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  openai:   ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  claude:   ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  kimi:     ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  doubao:   ['doubao-pro-32k', 'doubao-pro-4k', 'doubao-lite-32k', 'doubao-lite-4k'],
  grok:     ['grok-3', 'grok-3-mini', 'grok-2-1212'],
  qwen:     ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long'],
  wenxin:   ['ernie-4.0-8k', 'ernie-3.5-8k', 'ernie-lite-8k', 'ernie-speed-128k'],
};

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
