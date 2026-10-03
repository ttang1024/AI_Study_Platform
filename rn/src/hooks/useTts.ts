import { createAudioPlayer, type AudioPlayer, type AudioStatus } from 'expo-audio';

import {
  createUseTts,
  type TtsAudioDriver,
  type TtsAudioHandle,
  type TtsChunkCallbacks,
} from '@core/react/ttsQueue';
import {
  SLEEP_OPTIONS,
  type TtsError,
  type TtsItem,
  type TtsState,
  type UseTtsReturn,
} from '@core/tts';
import { synthesizeSpeech } from '@/services/ttsService';

export { SLEEP_OPTIONS };
export type { TtsError, TtsItem, TtsState, UseTtsReturn };

/**
 * Native half of the shared TTS queue. Each chunk gets its own AudioPlayer,
 * created imperatively — the source changes every chunk, and useAudioPlayer's
 * hook form assumes one source per component. `didJustFinish` on the player's
 * status event stands in for the web driver's `audio.onended`. The synthesized
 * files are cache-managed by ttsService, so there is nothing to discard.
 */
const nativeAudioDriver: TtsAudioDriver = {
  open(source: string, { onEnded }: TtsChunkCallbacks): TtsAudioHandle | null {
    let player: AudioPlayer;
    try {
      player = createAudioPlayer({ uri: source });
    } catch {
      return null;
    }

    let released = false;
    let subscription: { remove: () => void } | null = null;

    const release = () => {
      if (released) return;
      released = true;
      subscription?.remove();
      subscription = null;
      try { player.remove(); } catch {}
    };

    subscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      if (status.didJustFinish) { release(); onEnded(); }
    });
    player.play();

    return {
      pause: () => player.pause(),
      resume: () => player.play(),
      release,
    };
  },
};

export const useTts = createUseTts({
  synthesize: (text, signal) => synthesizeSpeech(text, signal),
  driver: nativeAudioDriver,
  synthesisErrorMessage: 'Voice synthesis failed. Please try again.',
});
