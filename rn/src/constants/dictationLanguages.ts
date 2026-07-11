// BCP-47 tags accepted by both the native SFSpeechRecognizer (iOS) and
// SpeechRecognizer (Android) backends that expo-speech-recognition wraps.
export interface DictationLanguage {
  code: string;
  label: string;
}

export const DICTATION_LANGUAGES: DictationLanguage[] = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'fr-FR', label: 'French' },
  { code: 'de-DE', label: 'German' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)' },
  { code: 'zh-CN', label: 'Chinese (Mandarin)' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'ko-KR', label: 'Korean' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'ar-SA', label: 'Arabic' },
  { code: 'ru-RU', label: 'Russian' },
];

export const DEFAULT_DICTATION_LANGUAGE = DICTATION_LANGUAGES[0];
