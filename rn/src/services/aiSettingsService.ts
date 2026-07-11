import * as SecureStore from 'expo-secure-store';

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

const DEFAULT_SETTINGS: AISettings = {
  provider: 'gemini',
  keys: {},
  models: {},
};

// Keys are stored on-device only (expo-secure-store, the Keychain/Keystore-backed
// equivalent of web's localStorage) and never synced to the server — they're sent
// per-request as X-AI-* headers, mirroring web/src/services/aiSettingsService.ts.
export const aiSettingsService = {
  async load(): Promise<AISettings> {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {}
    return { ...DEFAULT_SETTINGS };
  },

  async save(settings: AISettings): Promise<void> {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(settings));
  },

  async getActiveKey(): Promise<string | undefined> {
    const settings = await aiSettingsService.load();
    const key = settings.keys[settings.provider]?.trim();
    return key || undefined;
  },

  async getActiveProvider(): Promise<AIProvider> {
    return (await aiSettingsService.load()).provider;
  },

  async getActiveModel(): Promise<string> {
    const settings = await aiSettingsService.load();
    const model = settings.models[settings.provider]?.trim();
    return model || DEFAULT_MODELS[settings.provider];
  },
};
