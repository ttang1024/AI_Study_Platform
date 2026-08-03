import { DEFAULT_MODELS, type AIProvider, type AISettings } from './ai';

/**
 * Device-local settings that both clients persist themselves.
 *
 * The storage differs by platform and cannot be shared — web uses synchronous `localStorage`, rn
 * uses async `expo-secure-store`. What *can* be shared is everything around it: the storage keys
 * (a mismatch silently orphans a user's saved settings), the defaults, and the derivations that
 * turn a stored blob into "the provider/model/key to actually use". Those had drifted into two
 * copies each; this is the single copy, with the platform keeping only its own read/write.
 */

// ── AI provider settings ────────────────────────────────────────────────────

export const AI_SETTINGS_STORAGE_KEY = 'sp_ai_settings';

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'gemini',
  keys: {},
  models: {},
};

/** Tolerates absent/corrupt storage — a bad blob falls back to defaults rather than throwing. */
export const parseAiSettings = (raw: string | null | undefined): AISettings => {
  if (!raw) return { ...DEFAULT_AI_SETTINGS };
  try {
    return { ...DEFAULT_AI_SETTINGS, ...(JSON.parse(raw) as Partial<AISettings>) };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
};

export const activeProviderOf = (settings: AISettings): AIProvider => settings.provider;

/** Blank-but-present keys count as absent, so a cleared input doesn't send an empty header. */
export const activeKeyOf = (settings: AISettings): string | undefined =>
  settings.keys[settings.provider]?.trim() || undefined;

export const activeModelOf = (settings: AISettings): string =>
  settings.models[settings.provider]?.trim() || DEFAULT_MODELS[settings.provider];

// ── Text-to-speech settings ─────────────────────────────────────────────────

export interface TtsSettings {
  voice: string;
}

export const TTS_SETTINGS_STORAGE_KEY = 'sp_tts_settings';

export const DEFAULT_TTS_SETTINGS: TtsSettings = {
  voice: 'en-US-AriaNeural',
};

export const parseTtsSettings = (raw: string | null | undefined): TtsSettings => {
  if (!raw) return { ...DEFAULT_TTS_SETTINGS };
  try {
    return { ...DEFAULT_TTS_SETTINGS, ...(JSON.parse(raw) as Partial<TtsSettings>) };
  } catch {
    return { ...DEFAULT_TTS_SETTINGS };
  }
};

export const resolveVoice = (settings: TtsSettings): string =>
  settings.voice.trim() || DEFAULT_TTS_SETTINGS.voice;
