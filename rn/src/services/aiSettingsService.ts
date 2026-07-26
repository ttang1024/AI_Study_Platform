import * as SecureStore from 'expo-secure-store';

// The provider list, default models, and settings shape are shared across
// web/, rn/, and extension/ (see packages/core/src/ai.ts). Re-exported here so
// existing `@/services/aiSettingsService` imports keep working unchanged.
import { DEFAULT_MODELS } from '@core/ai';
import type { AIProvider, AISettings } from '@core/ai';

export { DEFAULT_MODELS } from '@core/ai';
export type { AIProvider, AISettings } from '@core/ai';

const STORAGE_KEY = 'sp_ai_settings';

const DEFAULT_SETTINGS: AISettings = {
  provider: 'gemini',
  keys: {},
  models: {},
};

// Notified whenever settings are saved, so UI that reacts to key presence (e.g. the
// missing-key banner) can re-check. RN has no window/storage events, so this stands
// in for web's AI_SETTINGS_CHANGED_EVENT + 'storage' listeners.
const changeListeners = new Set<() => void>();

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
    changeListeners.forEach((listener) => listener());
  },

  /** Subscribe to settings saves. Returns an unsubscribe function. */
  onChange(listener: () => void): () => void {
    changeListeners.add(listener);
    return () => changeListeners.delete(listener);
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
