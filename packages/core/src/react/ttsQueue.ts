/**
 * The text-to-speech queue, shared by web/ and rn/.
 *
 * Both apps drive the same machine — synthesize an item's text into an ordered
 * list of audio chunks, play them back to back, advance to the next item, with
 * a sleep timer over the top. Only *playing one chunk* differs: web builds an
 * HTMLAudioElement over a blob URL, rn an expo-audio AudioPlayer over a file
 * URI. That difference is the `TtsAudioDriver` seam; everything else lives here.
 *
 * Written with `createElement`-free plain TS so it needs no JSX transform, and
 * React is a peer dependency — this module is deliberately not re-exported from
 * the package root, so importing `@study/core` still pulls in nothing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { TtsErrorCode, TtsError, TtsItem, TtsState, UseTtsReturn } from '../tts';
import { formatSleepCountdown } from '../tts';

/** One chunk of audio, already handed to the platform's player. */
export interface TtsAudioHandle {
  pause(): void;
  resume(): void;
  /** Stop playback and free the chunk's resources. Must tolerate being called twice. */
  release(): void;
}

export interface TtsChunkCallbacks {
  /** The chunk played to its end — advance the queue. */
  onEnded(): void;
  /** The chunk could not be played — abandon the queue. */
  onFailed(): void;
}

export interface TtsAudioDriver {
  /**
   * Start playing `source`. Returning null means playback could not even be
   * started, which is treated exactly like `onFailed`.
   */
  open(source: string, callbacks: TtsChunkCallbacks): TtsAudioHandle | null;
  /**
   * Free sources the queue will never reach — called when playback is
   * interrupted mid-item. Web revokes its object URLs here; rn needs nothing.
   */
  discard?(sources: string[]): void;
}

export interface TtsQueueConfig {
  /** Text in, ordered playable chunk sources out. */
  synthesize(text: string, signal: AbortSignal): Promise<string[]>;
  driver: TtsAudioDriver;
  /** Shown when synthesis fails; each app words this its own way. */
  synthesisErrorMessage: string;
  /** Web tags every failure 'api_error'; rn reports the message alone. */
  errorCode?: TtsErrorCode;
}

/**
 * Builds a platform's `useTts`. Call once per app at module scope — the
 * returned hook is an ordinary hook and follows the usual rules.
 */
export function createUseTts(config: TtsQueueConfig): (items: TtsItem[]) => UseTtsReturn {
  const { synthesize, driver, synthesisErrorMessage, errorCode } = config;

  /**
   * `items` is only the initial queue. The sole caller (the TTS context) passes a stable empty
   * constant and fills the queue through `setItems`, so in practice it never changes after mount —
   * the render-time sync below keeps the hook correct if that ever stops being true.
   */
  return function useTts(items: TtsItem[]): UseTtsReturn {
    const [storedItems, setStoredItems] = useState(items);
    const [playerState, setPlayerState] = useState<TtsState>('idle');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [ttsError, setTtsError] = useState<TtsError | null>(null);
    const [sleepTimeLeft, setSleepTimeLeft] = useState<string | null>(null);
    const [hasSleepTimer, setHasSleepTimer] = useState(false);

    const isActiveRef = useRef(false);
    const currentIndexRef = useRef(0);
    const itemsRef = useRef(items);
    const handleRef = useRef<TtsAudioHandle | null>(null);
    const pendingSourcesRef = useRef<string[]>([]);
    const abortRef = useRef<AbortController | null>(null);
    const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sleepCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Adjusting state during render rather than in an effect — React's documented pattern for "reset
    // state when a prop changes". The effect form costs an extra committed render on every change of
    // `items`. `setItems` can still override locally; a later render with an unchanged `items`
    // reference leaves it alone, which is what an effect's dependency array used to guarantee.
    const [itemsSource, setItemsSource] = useState(items);
    if (items !== itemsSource) {
      setItemsSource(items);
      setStoredItems(items);
    }

    // The refs stay on effects: they are read by playback callbacks, and writing them during a
    // render React may discard would leave them describing a render that never committed.
    useEffect(() => { itemsRef.current = items; }, [items]);
    useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

    const replaceItems = useCallback((nextItems: TtsItem[]) => {
      itemsRef.current = nextItems;
      setStoredItems(nextItems);
    }, []);

    const releaseAudio = useCallback(() => {
      if (handleRef.current) {
        handleRef.current.release();
        handleRef.current = null;
      }
      if (pendingSourcesRef.current.length > 0) {
        driver.discard?.(pendingSourcesRef.current);
        pendingSourcesRef.current = [];
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
      releaseAudio();
      setPlayerState('idle');
      clearSleepTimer();
    }, [releaseAudio, clearSleepTimer]);

    const clearError = useCallback(() => setTtsError(null), []);

    // playAtIndex recurses (advancing to the next item once the current one's chunks finish) —
    // routed through a ref so the recursive call doesn't reference the `const` before assignment.
    const playAtIndexRef = useRef<(index: number) => void>(() => {});

    const playAtIndex = useCallback((index: number) => {
      const current = itemsRef.current;
      if (index < 0 || index >= current.length) { stop(); return; }

      releaseAudio();

      isActiveRef.current = true;
      setCurrentIndex(index);
      currentIndexRef.current = index;
      setTtsError(null);
      setPlayerState('loading');

      const controller = new AbortController();
      abortRef.current = controller;

      synthesize(current[index].text, controller.signal)
        .then((sources) => {
          // Interrupted while synthesis was in flight: nothing will ever play these.
          if (controller.signal.aborted || !isActiveRef.current) {
            driver.discard?.(sources);
            return;
          }
          abortRef.current = null;

          let chunkIdx = 0;
          pendingSourcesRef.current = [...sources];

          const playNextChunk = () => {
            if (!isActiveRef.current) return;

            if (chunkIdx >= sources.length) {
              pendingSourcesRef.current = [];
              const next = currentIndexRef.current + 1;
              setCurrentIndex(next);
              currentIndexRef.current = next;
              playAtIndexRef.current(next);
              return;
            }

            const source = sources[chunkIdx++];
            // Everything from here on is either playing or already played, so only the
            // remainder is still the queue's to discard.
            pendingSourcesRef.current = sources.slice(chunkIdx);

            const handle = driver.open(source, {
              onEnded: () => {
                if (handleRef.current === handle) handleRef.current = null;
                playNextChunk();
              },
              onFailed: () => { if (isActiveRef.current) stop(); },
            });

            if (!handle) { if (isActiveRef.current) stop(); return; }

            handleRef.current = handle;
            setPlayerState('playing');
          };

          playNextChunk();
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          // Truthiness, not `??`: a rejection carrying an empty message would otherwise
          // render as a blank error bar, which tells the user nothing.
          const message = (err as { message?: string })?.message || synthesisErrorMessage;
          setTtsError(errorCode ? { code: errorCode, message } : { message });
          stop();
        });
    }, [stop, releaseAudio]);
    useEffect(() => { playAtIndexRef.current = playAtIndex; });

    const play = useCallback((index?: number) => {
      playAtIndex(index ?? currentIndexRef.current);
    }, [playAtIndex]);

    const pause = useCallback(() => {
      handleRef.current?.pause();
      isActiveRef.current = false;
      setPlayerState('paused');
    }, []);

    const resume = useCallback(() => {
      handleRef.current?.resume();
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
        const label = formatSleepCountdown(end - Date.now());
        setSleepTimeLeft(label);
        if (label === null && sleepCountdownRef.current) clearInterval(sleepCountdownRef.current);
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
  };
}
