import { useCallback, useRef, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { getApiErrorMessage } from '../utils/apiError';
import type { PronunciationResult } from '../services/languageService';

// The scorecard shape is shared with rn (packages/core). Only the upload differs:
// web posts a MediaRecorder Blob, rn a file URI from expo-audio — which is why
// this call stays here rather than moving into the shared service.
export type { PronunciationResult, WordScore } from '../services/languageService';

/**
 * Records a spoken attempt and has the server score it.
 *
 * The recording is held only long enough to upload — a clip of someone's voice is not something to
 * keep, and the score is the only part with lasting value. The media stream's tracks are stopped
 * explicitly on finish, or the browser leaves the microphone indicator on.
 */
export function usePronunciationPractice() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [error, setError] = useState('');

  const score = useCallback(async (blob: Blob, targetPhrase: string) => {
    setScoring(true);
    setError('');
    try {
      const form = new FormData();
      form.append('audio', blob, 'attempt.webm');
      form.append('targetPhrase', targetPhrase);

      const res = await apiClient.post('/api/language/pronunciation', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data?.data ?? null);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not score that recording.'));
    } finally {
      setScoring(false);
    }
  }, []);

  const start = useCallback(async () => {
    setError('');
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Releases the microphone; without this the browser keeps showing it as in use.
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError('Microphone access was refused, so there is nothing to score.');
    }
  }, []);

  const stopAndScore = useCallback(
    (targetPhrase: string) => {
      const recorder = recorderRef.current;
      if (!recorder) return;

      recorder.addEventListener(
        'stop',
        () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          chunksRef.current = [];
          void score(blob, targetPhrase);
        },
        { once: true },
      );

      recorder.stop();
      recorderRef.current = null;
      setRecording(false);
    },
    [score],
  );

  return { recording, scoring, result, error, start, stopAndScore, reset: () => setResult(null) };
}
