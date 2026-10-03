import * as SecureStore from 'expo-secure-store';

// The provider list, default models, settings shape, storage key, and the
// active-provider/key/model derivations are shared across web/, rn/, and extension/
// (see packages/core/src/ai.ts and packages/core/src/settings.ts). Only the storage
// itself is per-platform — expo-secure-store here, localStorage on web. Re-exported so
// existing `@/services/aiSettingsService` imports keep working unchanged.
import {
  AI_SETTINGS_STORAGE_KEY,
  activeKeyOf,
  activeModelOf,
  activeProviderOf,
  parseAiSettings,
} from '@core/settings';
import type { AIProvider, AISettings } from '@core/ai';

export { DEFAULT_MODELS } from '@core/ai';
export type { AIProvider, AISettings } from '@core/ai';

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
      return parseAiSettings(await SecureStore.getItemAsync(AI_SETTINGS_STORAGE_KEY));
    } catch {
      // The keychain read itself can fail (locked device, simulator quirks).
      return parseAiSettings(null);
    }
  },

  async save(settings: AISettings): Promise<void> {
    await SecureStore.setItemAsync(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    changeListeners.forEach((listener) => listener());
  },

  /** Subscribe to settings saves. Returns an unsubscribe function. */
  onChange(listener: () => void): () => void {
    changeListeners.add(listener);
    return () => changeListeners.delete(listener);
  },

  async getActiveKey(): Promise<string | undefined> {
    return activeKeyOf(await aiSettingsService.load());
  },

  async getActiveProvider(): Promise<AIProvider> {
    return activeProviderOf(await aiSettingsService.load());
  },

  async getActiveModel(): Promise<string> {
    return activeModelOf(await aiSettingsService.load());
  },
};
