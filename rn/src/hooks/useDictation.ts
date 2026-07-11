import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { ExpoSpeechRecognitionModule as ExpoSpeechRecognitionModuleType } from 'expo-speech-recognition';

// `expo-speech-recognition` is a native module that isn't bundled in Expo Go
// and only exists once the dev client has been rebuilt with it linked
// (`npx expo prebuild` + `run:ios`/`run:android`, or an EAS dev build).
// `requireNativeModule` throws synchronously at import time when it's
// missing, which would otherwise crash the whole app (chat included) rather
// than just disabling the mic button — so the package is loaded via a
// guarded `require`, and the entire hook implementation is picked once at
// module-eval time based on whether that succeeded. This is a static branch
// (not a per-render conditional), so it doesn't violate the rules of hooks.
let speechRecognition: typeof import('expo-speech-recognition') | null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  speechRecognition = require('expo-speech-recognition');
} catch {
  speechRecognition = null;
}

function useDictationUnavailable(_onText: (text: string) => void, _lang?: string) {
  const toggle = useCallback(() => {}, []);
  return { listening: false, toggle, supported: false };
}

function useDictationNative(
  onText: (text: string) => void,
  ExpoSpeechRecognitionModule: typeof ExpoSpeechRecognitionModuleType,
  lang: string,
) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => {
    try {
      return ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
      return false;
    }
  });
  const textsRef = useRef<string[]>([]);
  const onTextRef = useRef(onText);
  useEffect(() => { onTextRef.current = onText; });
  const langRef = useRef(lang);
  useEffect(() => { langRef.current = lang; });

  // Subscribed directly (rather than via the package's `useSpeechRecognitionEvent`
  // hook) so these callbacks run inside our own effect, where reading/writing
  // refs is unambiguously safe.
  useEffect(() => {
    const subscriptions = [
      ExpoSpeechRecognitionModule.addListener('result', (event) => {
        if (!event.isFinal) return;
        const transcript = event.results[0]?.transcript;
        if (!transcript) return;
        textsRef.current = [...textsRef.current, transcript];
        onTextRef.current(textsRef.current.join(' '));
      }),
      ExpoSpeechRecognitionModule.addListener('end', () => setListening(false)),
      ExpoSpeechRecognitionModule.addListener('error', (event) => {
        setListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          Alert.alert('Microphone access needed', 'Enable microphone and speech recognition access in system settings to use voice input.');
        }
      }),
    ];
    return () => subscriptions.forEach((sub) => sub.remove());
  }, [ExpoSpeechRecognitionModule]);

  const toggle = useCallback(async () => {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) return;
      textsRef.current = [];
      setListening(true);
      ExpoSpeechRecognitionModule.start({
        lang: langRef.current,
        continuous: true,
        interimResults: false,
      });
    } catch {
      setListening(false);
    }
  }, [listening, ExpoSpeechRecognitionModule]);

  useEffect(() => () => {
    try { ExpoSpeechRecognitionModule.stop(); } catch {}
  }, [ExpoSpeechRecognitionModule]);

  return { listening, toggle, supported };
}

// RN port of web/src/components/tutor/useDictation.ts. The browser's
// SpeechRecognition API accumulates every final transcript of a continuous
// session into `e.results` for you; expo-speech-recognition's `result` event
// only carries the latest utterance, so this hook accumulates finals itself
// and re-emits the joined transcript on every one, matching the web
// behavior of overwriting the caller's text with "the session so far".
export const useDictation = speechRecognition
  ? (onText: (text: string) => void, lang = 'en-US') =>
      useDictationNative(onText, speechRecognition!.ExpoSpeechRecognitionModule, lang)
  : useDictationUnavailable;
