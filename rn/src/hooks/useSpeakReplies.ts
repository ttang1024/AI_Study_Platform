import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from 'expo-audio';

import { synthesizeSpeech } from '@/services/ttsService';
import { markdownToPlainText } from '@/utils/markdownToPlainText';

// RN port of web/src/components/ai/useSpeakReplies.ts — reads a single chat
// message aloud on demand. Deliberately separate from the queue-based
// useTts/TtsContext (which drives the persistent, app-wide player bar):
// chat replies are read one at a time and shouldn't hijack that session.
export const useSpeakReplies = () => {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const listenerRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => () => {
    listenerRef.current?.remove();
    if (playerRef.current) { try { playerRef.current.remove(); } catch {} }
  }, []);

  const stopSpeaking = useCallback(() => {
    listenerRef.current?.remove();
    listenerRef.current = null;
    if (playerRef.current) {
      try { playerRef.current.remove(); } catch {}
      playerRef.current = null;
    }
    setSpeakingId(null);
  }, []);

  const speak = useCallback(async (id: string, content: string) => {
    if (speakingId === id) { stopSpeaking(); return; }
    stopSpeaking();
    setSpeakingId(id);
    try {
      const uris = await synthesizeSpeech(markdownToPlainText(content));
      const playNext = (i: number) => {
        if (i >= uris.length) {
          setSpeakingId(null);
          return;
        }
        const player = createAudioPlayer({ uri: uris[i] });
        playerRef.current = player;
        const subscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
          if (status.didJustFinish) {
            subscription.remove();
            if (listenerRef.current === subscription) listenerRef.current = null;
            try { player.remove(); } catch {}
            if (playerRef.current === player) playerRef.current = null;
            playNext(i + 1);
          }
        });
        listenerRef.current = subscription;
        player.play();
      };
      playNext(0);
    } catch {
      setSpeakingId(null);
    }
  }, [speakingId, stopSpeaking]);

  return { speakingId, speak, stopSpeaking };
};
