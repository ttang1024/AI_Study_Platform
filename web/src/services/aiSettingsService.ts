// The provider list, default models, settings shape, storage key, and the
// active-provider/key/model derivations are shared across web/, rn/, and extension/
// (see packages/core/src/ai.ts and packages/core/src/settings.ts). Only the storage
// itself is per-platform — localStorage here, expo-secure-store in rn. Re-exported so
// existing `@/services/aiSettingsService` imports keep working unchanged.
import {
  AI_SETTINGS_STORAGE_KEY,
  activeKeyOf,
  activeModelOf,
  activeProviderOf,
  parseAiSettings,
} from '@core/settings';
export { DEFAULT_MODELS } from '@core/ai';
export type { AIProvider, AISettings } from '@core/ai';
import type { AIProvider, AISettings } from '@core/ai';

/** Fired on window after save() — the `storage` event only fires in other tabs. */
export const AI_SETTINGS_CHANGED_EVENT = 'sp-ai-settings-changed';

export const aiSettingsService = {
  load(): AISettings {
    try {
      return parseAiSettings(localStorage.getItem(AI_SETTINGS_STORAGE_KEY));
    } catch {
      // localStorage itself can throw (private mode, disabled storage).
      return parseAiSettings(null);
    }
  },

  save(settings: AISettings): void {
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event(AI_SETTINGS_CHANGED_EVENT));
  },

  getActiveKey(): string | undefined {
    return activeKeyOf(aiSettingsService.load());
  },

  getActiveProvider(): AIProvider {
    return activeProviderOf(aiSettingsService.load());
  },

  getActiveModel(): string {
    return activeModelOf(aiSettingsService.load());
  },
};
