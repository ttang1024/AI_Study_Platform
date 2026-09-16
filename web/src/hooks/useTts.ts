import {
  createUseTts,
  type TtsAudioDriver,
  type TtsAudioHandle,
  type TtsChunkCallbacks,
} from '@core/react/ttsQueue';
import {
  formatSleepCountdown,
  SLEEP_OPTIONS,
  type TtsError,
  type TtsItem,
  type TtsState,
  type UseTtsReturn,
} from '@core/tts';
import { synthesizeSpeech } from '../services/edgeTtsService';

export { SLEEP_OPTIONS, formatSleepCountdown };
export type { TtsError, TtsItem, TtsState, UseTtsReturn };

/**
 * Browser half of the shared TTS queue: one HTMLAudioElement per chunk over the
 * blob URL `synthesizeSpeech` hands back. Each handle owns its own object URL and
 * revokes it on release or on ending, so the only URLs left for the queue to
 * discard are the chunks it never reached.
 */
const webAudioDriver: TtsAudioDriver = {
  open(source: string, { onEnded, onFailed }: TtsChunkCallbacks): TtsAudioHandle | null {
    const audio = new Audio(source);
    let released = false;

    const release = () => {
      if (released) return;
      released = true;
      audio.pause();
      audio.onended = null;
      URL.revokeObjectURL(source);
    };

    audio.onended = () => { release(); onEnded(); };
    audio.play().catch(() => { release(); onFailed(); });

    return {
      pause: () => audio.pause(),
      resume: () => { audio.play().catch(() => {}); },
      release,
    };
  },
  discard(sources: string[]) {
    sources.forEach(URL.revokeObjectURL);
  },
};

export const useTts = createUseTts({
  synthesize: (text, signal) => synthesizeSpeech(text, signal),
  driver: webAudioDriver,
  synthesisErrorMessage: 'TTS failed. Please try again.',
  errorCode: 'api_error',
});
