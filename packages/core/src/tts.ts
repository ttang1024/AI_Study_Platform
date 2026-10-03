// Platform-agnostic half of the text-to-speech player, shared by web/ and rn/.
// The hook itself cannot live here — web drives an HTMLAudioElement and rn an
// expo-audio AudioPlayer — but the queue's vocabulary, the hook's public shape
// and the sleep-timer presets are identical on both, so they live here once.

import { formatCountdown } from './utils/format';

export interface TtsItem {
  text: string;
  title: string;
}

export type TtsState = 'idle' | 'loading' | 'playing' | 'paused';

export type TtsErrorCode = 'api_error';

/** `code` is optional: rn only ever reports a message, web tags every failure 'api_error'. */
export interface TtsError {
  code?: TtsErrorCode;
  message: string;
}

/** Sleep-timer presets offered by both transport bars. */
export const SLEEP_OPTIONS: ReadonlyArray<{ label: string; minutes: number }> = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '60 min', minutes: 60 },
];

/** The contract every platform's `useTts` implements. */
export interface UseTtsReturn {
  playerState: TtsState;
  currentIndex: number;
  ttsError: TtsError | null;
  items: TtsItem[];
  setItems: (items: TtsItem[]) => void;
  play: (index?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skipForward: () => void;
  skipBack: () => void;
  clearError: () => void;
  sleepTimeLeft: string | null;
  hasSleepTimer: boolean;
  setSleepTimer: (minutes: number) => void;
  cancelSleepTimer: () => void;
}

/**
 * `m:ss` remaining on the sleep timer, or null once it has run out — the null is the signal both
 * players use to clear the countdown interval, so it is deliberately not `'0:00'`.
 */
export function formatSleepCountdown(remainingMs: number): string | null {
  if (remainingMs <= 0) return null;
  return formatCountdown(remainingMs);
}
