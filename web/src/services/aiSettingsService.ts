// The provider list, default models, and settings shape are shared across
// web/, rn/, and extension/ (see packages/core/src/ai.ts). Re-exported here so
// existing `@/services/aiSettingsService` imports keep working unchanged.
import { DEFAULT_MODELS } from '@core/ai';
export { DEFAULT_MODELS } from '@core/ai';
export type { AIProvider, AISettings } from '@core/ai';
import type { AIProvider, AISettings } from '@core/ai';

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
