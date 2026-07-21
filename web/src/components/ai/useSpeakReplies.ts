import { useCallback, useEffect, useRef, useState } from 'react';
import { synthesizeSpeech } from '../../services/edgeTtsService';
import { markdownToPlainText } from './ChatMarkdown';

/** Read model replies aloud via Edge TTS; tracks which message is playing. */
export const useSpeakReplies = () => {
  const [speakReplies, setSpeakReplies] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onDoneRef = useRef<(() => void) | null>(null);

  // Stop any in-flight speech when the panel unmounts.
  useEffect(() => () => audioRef.current?.pause(), []);

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    onDoneRef.current = null;
    setSpeakingId(null);
  }, []);

  /**
   * Read a model reply aloud. Passing the same id again toggles playback off.
   * `onDone` fires after the last audio chunk finishes (not on manual stop).
   *
   * Stable across re-renders (except when speakingId itself changes) so consumers like
   * ChatMessageRow's React.memo aren't invalidated by unrelated parent re-renders.
   */
  const speak = useCallback(async (id: string, content: string, onDone?: () => void) => {
    if (speakingId === id) { stopSpeaking(); return; }
    audioRef.current?.pause();
    onDoneRef.current = onDone ?? null;
    setSpeakingId(id);
    try {
      const urls = await synthesizeSpeech(markdownToPlainText(content));
      const playNext = (i: number) => {
        if (i >= urls.length) {
          setSpeakingId(null);
          const done = onDoneRef.current;
          onDoneRef.current = null;
          done?.();
          return;
        }
        const audio = new Audio(urls[i]);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(urls[i]); playNext(i + 1); };
        void audio.play();
      };
      playNext(0);
    } catch {
      setSpeakingId(null);
      onDoneRef.current = null;
    }
  }, [speakingId, stopSpeaking]);

  return { speakReplies, setSpeakReplies, speakingId, speak, stopSpeaking };
};
