import { useState, useRef, useCallback, useEffect } from 'react';
import { synthesizeSpeech, HumeTtsError } from '../services/humeService';
import { ttsSettingsService } from '../services/ttsSettingsService';

export interface TtsItem {
  text: string;
  title: string;
}

export type TtsState = 'idle' | 'loading' | 'playing' | 'paused';
export type TtsErrorCode = 'no_key' | 'zero_credits' | 'api_error';
export interface TtsError { code: TtsErrorCode; message: string; }

const SLEEP_OPTIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '60 min', minutes: 60 },
];
export { SLEEP_OPTIONS };

export interface UseTtsReturn {
  playerState: TtsState;
  currentIndex: number;
  ttsError: TtsError | null;
  play: (index?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skipForward: () => void;
  skipBack: () => void;
  clearError: () => void;
  switchToBrowser: (index?: number) => void;
  sleepTimeLeft: string | null;
  hasSleepTimer: boolean;
  setSleepTimer: (minutes: number) => void;
  cancelSleepTimer: () => void;
}

export function useTts(items: TtsItem[]): UseTtsReturn {
  const [playerState, setPlayerState] = useState<TtsState>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ttsError, setTtsError] = useState<TtsError | null>(null);
  const [sleepTimeLeft, setSleepTimeLeft] = useState<string | null>(null);
  const [hasSleepTimer, setHasSleepTimer] = useState(false);

  const isActiveRef = useRef(false);
  const currentIndexRef = useRef(0);
  const itemsRef = useRef(items);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const pendingBlobUrlsRef = useRef<string[]>([]);
  const isBrowserTtsRef = useRef(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  itemsRef.current = items;
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  const releaseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    pendingBlobUrlsRef.current.forEach(URL.revokeObjectURL);
    pendingBlobUrlsRef.current = [];
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (utteranceRef.current) {
      speechSynthesis.cancel();
      utteranceRef.current = null;
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
    isBrowserTtsRef.current = false;
    releaseAudio();
    setPlayerState('idle');
    clearSleepTimer();
  }, [releaseAudio, clearSleepTimer]);

  const clearError = useCallback(() => setTtsError(null), []);

  const playAtIndex = useCallback((index: number) => {
    const current = itemsRef.current;
    if (index < 0 || index >= current.length) { stop(); return; }

    releaseAudio();

    // Browser TTS path
    if (isBrowserTtsRef.current) {
      isActiveRef.current = true;
      setCurrentIndex(index);
      currentIndexRef.current = index;
      setTtsError(null);
      setPlayerState('playing');

      const utterance = new SpeechSynthesisUtterance(current[index].text);
      utteranceRef.current = utterance;
      utterance.onend = () => {
        if (!isActiveRef.current) return;
        utteranceRef.current = null;
        const next = currentIndexRef.current + 1;
        setCurrentIndex(next);
        currentIndexRef.current = next;
        playAtIndex(next);
      };
      utterance.onerror = () => { if (isActiveRef.current) stop(); };
      speechSynthesis.speak(utterance);
      return;
    }

    const humeKey = ttsSettingsService.getHumeApiKey();

    // No API key — surface a prompt instead of starting playback
    if (!humeKey) {
      setTtsError({ code: 'no_key', message: 'Hume API key not configured.' });
      return;
    }

    isActiveRef.current = true;
    setCurrentIndex(index);
    currentIndexRef.current = index;
    setTtsError(null);
    setPlayerState('loading');

    const controller = new AbortController();
    abortRef.current = controller;

    synthesizeSpeech(current[index].text, controller.signal)
      .then((blobUrls) => {
        if (controller.signal.aborted) { blobUrls.forEach(URL.revokeObjectURL); return; }
        abortRef.current = null;

        pendingBlobUrlsRef.current = [...blobUrls];
        let chunkIdx = 0;

        const playNextChunk = () => {
          if (!isActiveRef.current) return;

          if (chunkIdx >= blobUrls.length) {
            pendingBlobUrlsRef.current = [];
            const next = currentIndexRef.current + 1;
            setCurrentIndex(next);
            currentIndexRef.current = next;
            playAtIndex(next);
            return;
          }

          const blobUrl = blobUrls[chunkIdx++];
          pendingBlobUrlsRef.current = blobUrls.slice(chunkIdx);
          blobUrlRef.current = blobUrl;
          const audio = new Audio(blobUrl);
          audioRef.current = audio;
          setPlayerState('playing');
          audio.onended = () => {
            URL.revokeObjectURL(blobUrl);
            blobUrlRef.current = null;
            audioRef.current = null;
            playNextChunk();
          };
          audio.play().catch(() => { if (isActiveRef.current) stop(); });
        };

        playNextChunk();
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err instanceof HumeTtsError) {
          setTtsError({ code: err.code, message: err.message });
        } else {
          setTtsError({ code: 'api_error', message: 'TTS failed. Please try again.' });
        }
        stop();
      });
  }, [stop, releaseAudio]);

  const play = useCallback((index?: number) => {
    playAtIndex(index ?? currentIndexRef.current);
  }, [playAtIndex]);

  const pause = useCallback(() => {
    if (isBrowserTtsRef.current) { speechSynthesis.pause(); }
    else if (audioRef.current) { audioRef.current.pause(); }
    isActiveRef.current = false;
    setPlayerState('paused');
  }, []);

  const resume = useCallback(() => {
    if (isBrowserTtsRef.current) { speechSynthesis.resume(); }
    else if (audioRef.current) { audioRef.current.play().catch(() => {}); }
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
    const end = new Date(Date.now() + minutes * 60 * 1000);
    setHasSleepTimer(true);
    sleepTimerRef.current = setTimeout(() => { stop(); }, minutes * 60 * 1000);
    sleepCountdownRef.current = setInterval(() => {
      const remaining = end.getTime() - Date.now();
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

  const switchToBrowser = useCallback((index?: number) => {
    releaseAudio();
    isBrowserTtsRef.current = true;
    setTtsError(null);
    playAtIndex(index ?? currentIndexRef.current);
  }, [releaseAudio, playAtIndex]);

  useEffect(() => () => { stop(); }, [stop]);

  return {
    playerState, currentIndex, ttsError,
    play, pause, resume, stop, skipForward, skipBack,
    clearError, switchToBrowser, sleepTimeLeft, hasSleepTimer, setSleepTimer, cancelSleepTimer,
  };
}
