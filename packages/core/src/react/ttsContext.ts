/**
 * The app-root TTS context, shared by web/ and rn/.
 *
 * One `useTts` instance lives above the whole app so playback survives
 * navigation, and a transport bar is rendered alongside `children` whenever the
 * queue is not idle. The two apps differ only in which `useTts` they build and
 * which component draws the bar, so both are injected.
 *
 * Uses `createElement` rather than JSX so this package needs no JSX transform.
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';

import type { TtsItem, TtsState, UseTtsReturn } from '../tts';

/** The prop contract both transport bars implement. */
export interface TtsPlayerProps {
  state: TtsState;
  title: string;
  subtitle?: string;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSkipBack?: () => void;
  onSkipForward?: () => void;
  disableSkipBack?: boolean;
  disableSkipForward?: boolean;
  sleepTimeLeft?: string | null;
  hasSleepTimer?: boolean;
  onSetSleepTimer?: (minutes: number) => void;
  onCancelSleepTimer?: () => void;
  error?: string | null;
  onDismissError?: () => void;
}

export interface TtsSession {
  sourceId: string;
  items: TtsItem[];
  getSubtitle?: (currentIndex: number, itemCount: number) => string;
}

export interface PersistentTtsOptions {
  getSubtitle?: (currentIndex: number, itemCount: number) => string;
}

/** What a screen gets: the full player, minus queue plumbing it shouldn't touch. */
export type PersistentTtsReturn = Omit<UseTtsReturn, 'items' | 'setItems' | 'play'> & {
  play: (index?: number) => void;
};

interface TtsContextValue {
  session: TtsSession | null;
  tts: UseTtsReturn;
  startSession: (session: TtsSession, index?: number) => void;
  updateSession: (session: TtsSession) => void;
}

export interface TtsContextParts {
  TtsProvider: ComponentType<{ children: ReactNode }>;
  usePersistentTts: (
    sourceId: string,
    items: TtsItem[],
    options?: PersistentTtsOptions,
  ) => PersistentTtsReturn;
}

const EMPTY_TTS_ITEMS: TtsItem[] = [];

export function createTtsContext(config: {
  useTts: (items: TtsItem[]) => UseTtsReturn;
  PlayerComponent: ComponentType<TtsPlayerProps>;
}): TtsContextParts {
  const { useTts, PlayerComponent } = config;
  const TtsContext = createContext<TtsContextValue | null>(null);

  const TtsProvider: ComponentType<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<TtsSession | null>(null);
    const tts = useTts(EMPTY_TTS_ITEMS);

    const startSession = useCallback((nextSession: TtsSession, index = 0) => {
      setSession(nextSession);
      tts.setItems(nextSession.items);
      tts.play(index);
    }, [tts.play, tts.setItems]);

    const updateSession = useCallback((nextSession: TtsSession) => {
      setSession(nextSession);
      tts.setItems(nextSession.items);
    }, [tts.setItems]);

    const subtitle = session?.getSubtitle?.(tts.currentIndex, tts.items.length);
    const title = tts.items[tts.currentIndex]?.title ?? '';

    const value = useMemo(
      () => ({ session, tts, startSession, updateSession }),
      [session, tts, startSession, updateSession],
    );

    const player = (tts.playerState !== 'idle' || tts.ttsError)
      ? createElement(PlayerComponent, {
          state: tts.playerState,
          title,
          subtitle,
          onPlay: tts.resume,
          onPause: tts.pause,
          onStop: tts.stop,
          onSkipBack: tts.skipBack,
          onSkipForward: tts.skipForward,
          disableSkipBack: tts.currentIndex === 0,
          disableSkipForward: tts.currentIndex >= tts.items.length - 1,
          sleepTimeLeft: tts.sleepTimeLeft,
          hasSleepTimer: tts.hasSleepTimer,
          onSetSleepTimer: tts.setSleepTimer,
          onCancelSleepTimer: tts.cancelSleepTimer,
          error: tts.ttsError?.message,
          onDismissError: tts.clearError,
        })
      : null;

    return createElement(TtsContext.Provider, { value }, children, player);
  };

  function usePersistentTts(
    sourceId: string,
    items: TtsItem[],
    options: PersistentTtsOptions = {},
  ): PersistentTtsReturn {
    const context = useContext(TtsContext);
    if (!context) {
      throw new Error('usePersistentTts must be used within TtsProvider');
    }

    const { session, tts, startSession, updateSession } = context;
    const isActiveSession = session?.sourceId === sourceId;

    useEffect(() => {
      if (!isActiveSession) return;
      updateSession({ sourceId, items, getSubtitle: options.getSubtitle });
    }, [items, sourceId, isActiveSession, options.getSubtitle, updateSession]);

    const play = useCallback((index = 0) => {
      startSession({ sourceId, items, getSubtitle: options.getSubtitle }, index);
    }, [items, options.getSubtitle, sourceId, startSession]);

    return {
      playerState: isActiveSession ? tts.playerState : 'idle',
      currentIndex: isActiveSession ? tts.currentIndex : 0,
      ttsError: isActiveSession ? tts.ttsError : null,
      play,
      pause: tts.pause,
      resume: tts.resume,
      stop: tts.stop,
      skipForward: tts.skipForward,
      skipBack: tts.skipBack,
      clearError: tts.clearError,
      sleepTimeLeft: tts.sleepTimeLeft,
      hasSleepTimer: tts.hasSleepTimer,
      setSleepTimer: tts.setSleepTimer,
      cancelSleepTimer: tts.cancelSleepTimer,
    };
  }

  return { TtsProvider, usePersistentTts };
}
