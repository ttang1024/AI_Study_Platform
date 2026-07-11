import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { TtsItem, useTts, UseTtsReturn } from '@/hooks/useTts';
import { TtsPlayerBar } from '@/components/tts/TtsPlayerBar';

interface TtsSession {
  sourceId: string;
  items: TtsItem[];
  getSubtitle?: (currentIndex: number, itemCount: number) => string;
}

interface PersistentTtsOptions {
  getSubtitle?: (currentIndex: number, itemCount: number) => string;
}

type PersistentTtsReturn = Omit<UseTtsReturn, 'items' | 'setItems' | 'play'> & {
  play: (index?: number) => void;
};

interface TtsContextValue {
  session: TtsSession | null;
  tts: UseTtsReturn;
  startSession: (session: TtsSession, index?: number) => void;
  updateSession: (session: TtsSession) => void;
}

const TtsContext = createContext<TtsContextValue | null>(null);
const EMPTY_TTS_ITEMS: TtsItem[] = [];

// RN port of web/src/context/TtsContext.tsx — a single shared useTts instance
// lives at the app root so playback (e.g. reading a note list) survives
// navigating to another tab, with a floating TtsPlayerBar as the transport UI.
export const TtsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<TtsSession | null>(null);
  const tts = useTts(EMPTY_TTS_ITEMS);

  const startSession = useCallback((nextSession: TtsSession, index = 0) => {
    setSession(nextSession);
    tts.setItems(nextSession.items);
    tts.play(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tts.play, tts.setItems]);

  const updateSession = useCallback((nextSession: TtsSession) => {
    setSession(nextSession);
    tts.setItems(nextSession.items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tts.setItems]);

  const subtitle = session?.getSubtitle?.(tts.currentIndex, tts.items.length);
  const title = tts.items[tts.currentIndex]?.title ?? '';

  const value = useMemo(
    () => ({ session, tts, startSession, updateSession }),
    [session, tts, startSession, updateSession],
  );

  return (
    <TtsContext.Provider value={value}>
      {children}
      {(tts.playerState !== 'idle' || tts.ttsError) && (
        <TtsPlayerBar
          state={tts.playerState}
          title={title}
          subtitle={subtitle}
          onPlay={tts.resume}
          onPause={tts.pause}
          onStop={tts.stop}
          onSkipBack={tts.skipBack}
          onSkipForward={tts.skipForward}
          disableSkipBack={tts.currentIndex === 0}
          disableSkipForward={tts.currentIndex >= tts.items.length - 1}
          sleepTimeLeft={tts.sleepTimeLeft}
          hasSleepTimer={tts.hasSleepTimer}
          onSetSleepTimer={tts.setSleepTimer}
          onCancelSleepTimer={tts.cancelSleepTimer}
          error={tts.ttsError?.message}
          onDismissError={tts.clearError}
        />
      )}
    </TtsContext.Provider>
  );
};

export function usePersistentTts(
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
