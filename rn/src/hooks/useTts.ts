import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from 'expo-audio';

import { synthesizeSpeech } from '@/services/ttsService';

export interface TtsItem {
  text: string;
  title: string;
}

export type TtsState = 'idle' | 'loading' | 'playing' | 'paused';
export interface TtsError { message: string }

export const SLEEP_OPTIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '60 min', minutes: 60 },
];

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

// RN port of web/src/hooks/useTts.ts. The web version drives a single
// HTMLAudioElement per chunk; here each chunk gets its own expo-audio
// AudioPlayer (created imperatively via createAudioPlayer, since the source
// changes every chunk/item — useAudioPlayer's hook form assumes one source
// per component). `didJustFinish` on the player's status event stands in for
// the web version's `audio.onended`.
/**
 * `items` is only the initial queue. The sole caller (TtsContext) passes a stable empty constant and
 * populates the queue through `replaceItems`, so in practice this argument never changes after mount
 * — the render-time sync below exists to keep the hook correct if that ever stops being true.
 */
export function useTts(items: TtsItem[]): UseTtsReturn {
  const [storedItems, setStoredItems] = useState(items);
  const [playerState, setPlayerState] = useState<TtsState>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ttsError, setTtsError] = useState<TtsError | null>(null);
  const [sleepTimeLeft, setSleepTimeLeft] = useState<string | null>(null);
  const [hasSleepTimer, setHasSleepTimer] = useState(false);

  const isActiveRef = useRef(false);
  const currentIndexRef = useRef(0);
  const itemsRef = useRef(items);
  const playerRef = useRef<AudioPlayer | null>(null);
  const listenerRef = useRef<{ remove: () => void } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Adjusting state during render rather than in an effect — React's documented pattern for "reset
  // state when a prop changes". The effect form cost an extra committed render on every change of
  // `items`, and re-entered the same setState the compiler's effect analysis rejects. `replaceItems`
  // can still override locally; a later render with an unchanged `items` reference leaves it alone,
  // which is exactly what the effect's dependency array used to guarantee.
  const [itemsSource, setItemsSource] = useState(items);
  if (items !== itemsSource) {
    setItemsSource(items);
    setStoredItems(items);
  }

  // The ref stays on the effect: it is read by playback callbacks, and moving the write into render
  // would mutate it during a render React may discard.
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  const replaceItems = useCallback((nextItems: TtsItem[]) => {
    itemsRef.current = nextItems;
    setStoredItems(nextItems);
  }, []);

  const releasePlayer = useCallback(() => {
    listenerRef.current?.remove();
    listenerRef.current = null;
    if (playerRef.current) {
      try { playerRef.current.remove(); } catch {}
      playerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const clearSleepTimer = useCallback(() => {
    if (sleepTimerRef.current) { clearTimeout(sleepTimerRef.current); sleepTimerRef.current = null; }
    if (sleepCountdownRef.current) { clearInterval(sleepCountdownRef.current); sleepCountdownRef.current = null; }
    setHasSleepTimer(false);
    setSleepTimeLeft(null);
  }, []);

  const stop = useCallback(() => {
    isActiveRef.current = false;
    releasePlayer();
    setPlayerState('idle');
    clearSleepTimer();
  }, [releasePlayer, clearSleepTimer]);

  const clearError = useCallback(() => setTtsError(null), []);

  // playAtIndex recurses (advances to the next item once the current one's
  // chunks finish) — routed through a ref so the recursive call doesn't
  // reference the `const playAtIndex` binding before it's assigned.
  const playAtIndexRef = useRef<(index: number) => void>(() => {});

  const playAtIndex = useCallback((index: number) => {
    const current = itemsRef.current;
    if (index < 0 || index >= current.length) { stop(); return; }

    releasePlayer();

    isActiveRef.current = true;
    setCurrentIndex(index);
    currentIndexRef.current = index;
    setTtsError(null);
    setPlayerState('loading');

    const controller = new AbortController();
    abortRef.current = controller;

    synthesizeSpeech(current[index].text, controller.signal)
      .then((uris) => {
        if (!isActiveRef.current) return;
        abortRef.current = null;

        let chunkIdx = 0;

        const playNextChunk = () => {
          if (!isActiveRef.current) return;

          if (chunkIdx >= uris.length) {
            const next = currentIndexRef.current + 1;
            setCurrentIndex(next);
            currentIndexRef.current = next;
            playAtIndexRef.current(next);
            return;
          }

          const uri = uris[chunkIdx++];
          let player: AudioPlayer;
          try {
            player = createAudioPlayer({ uri });
          } catch {
            if (isActiveRef.current) stop();
            return;
          }
          playerRef.current = player;
          setPlayerState('playing');

          const subscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
            if (status.didJustFinish) {
              subscription.remove();
              if (listenerRef.current === subscription) listenerRef.current = null;
              try { player.remove(); } catch {}
              if (playerRef.current === player) playerRef.current = null;
              playNextChunk();
            }
          });
          listenerRef.current = subscription;
          player.play();
        };

        playNextChunk();
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setTtsError({ message: err?.message ?? 'Voice synthesis failed. Please try again.' });
        stop();
      });
  }, [stop, releasePlayer]);
  useEffect(() => { playAtIndexRef.current = playAtIndex; });

  const play = useCallback((index?: number) => {
    playAtIndex(index ?? currentIndexRef.current);
  }, [playAtIndex]);

  const pause = useCallback(() => {
    playerRef.current?.pause();
    isActiveRef.current = false;
    setPlayerState('paused');
  }, []);

  const resume = useCallback(() => {
    playerRef.current?.play();
    isActiveRef.current = true;
    setPlayerState('playing');
  }, []);

  const skipForward = useCallback(() => {
    playAtIndex(currentIndexRef.current + 1);
  }, [playAtIndex]);

  const skipBack = useCallback(() => {
    playAtIndex(Math.max(0, currentIndexRef.current - 1));
  }, [playAtIndex]);

  const setSleepTimer = useCallback((minutes: number) => {
    clearSleepTimer();
    const end = Date.now() + minutes * 60 * 1000;
    setHasSleepTimer(true);
    sleepTimerRef.current = setTimeout(() => { stop(); }, minutes * 60 * 1000);
    sleepCountdownRef.current = setInterval(() => {
      const remaining = end - Date.now();
      if (remaining <= 0) {
        setSleepTimeLeft(null);
        if (sleepCountdownRef.current) clearInterval(sleepCountdownRef.current);
      } else {
        const m = Math.floor(remaining / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        setSleepTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);
  }, [clearSleepTimer, stop]);

  const cancelSleepTimer = useCallback(() => { clearSleepTimer(); }, [clearSleepTimer]);

  useEffect(() => () => { stop(); }, [stop]);

  return {
    playerState, currentIndex, ttsError,
    items: storedItems,
    setItems: replaceItems,
    play, pause, resume, stop, skipForward, skipBack,
    clearError, sleepTimeLeft, hasSleepTimer, setSleepTimer, cancelSleepTimer,
  };
}
