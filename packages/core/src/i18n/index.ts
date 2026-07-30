import { de } from './de';
import { en, type TranslationKey } from './en';
import { es } from './es';
import { fr } from './fr';
import { ja } from './ja';
import { ko } from './ko';
import { ptBR } from './ptBR';
import { zhCN } from './zhCN';

export { de, en, es, fr, ja, ko, ptBR, zhCN };
export type { TranslationKey };

/**
 * Locales the interface is available in, and the languages material can be translated into.
 *
 * `nativeName` is what a language switcher shows — a list written in the reader's *current*
 * language is useless to the person who cannot read it. `englishName` is what goes to the model
 * when translating material: a prompt reads "translate into Simplified Chinese" more reliably than
 * "translate into 简体中文", and it is the field that distinguishes pt-BR from European Portuguese.
 *
 * Region-tagged codes are used only where the region changes the text (pt-BR vs pt-PT, zh-CN vs
 * zh-TW); everything else stays a bare language subtag. `resolveLocale` maps a bare tag onto the
 * region-tagged entry, so a `pt` browser still lands on Brazilian Portuguese.
 */
export const LOCALES = [
  { code: 'en', flag: '🇺🇸', nativeName: 'English', englishName: 'English' },
  { code: 'es', flag: '🇪🇸', nativeName: 'Español', englishName: 'Spanish' },
  { code: 'pt-BR', flag: '🇧🇷', nativeName: 'Português (Brasil)', englishName: 'Brazilian Portuguese' },
  { code: 'fr', flag: '🇫🇷', nativeName: 'Français', englishName: 'French' },
  { code: 'de', flag: '🇩🇪', nativeName: 'Deutsch', englishName: 'German' },
  { code: 'ja', flag: '🇯🇵', nativeName: '日本語', englishName: 'Japanese' },
  { code: 'ko', flag: '🇰🇷', nativeName: '한국어', englishName: 'Korean' },
  { code: 'zh-CN', flag: '🇨🇳', nativeName: '简体中文', englishName: 'Simplified Chinese' },
] as const;

export type Locale = (typeof LOCALES)[number];
export type LocaleCode = Locale['code'];

export const DICTIONARIES: Record<LocaleCode, Partial<Record<TranslationKey, string>>> = {
  en,
  es,
  'pt-BR': ptBR,
  fr,
  de,
  ja,
  ko,
  'zh-CN': zhCN,
};

export const isLocale = (value: string | null | undefined): value is LocaleCode =>
  value != null && LOCALES.some((l) => l.code === value);

/** The locale entry for a code, for the pickers and for the translation request. */
export const getLocale = (code: LocaleCode): Locale =>
  LOCALES.find((l) => l.code === code) ?? LOCALES[0];

/**
 * Best supported locale for a BCP-47 tag from the browser or device, or null when there is none.
 *
 * Matches the full tag first, then the primary subtag, so `pt-PT` and a bare `pt` both reach
 * `pt-BR` — the wrong region of the right language beats English.
 */
export const resolveLocale = (tag: string | null | undefined): LocaleCode | null => {
  if (!tag) return null;

  const wanted = tag.toLowerCase();
  const exact = LOCALES.find((l) => l.code.toLowerCase() === wanted);
  if (exact) return exact.code;

  const primary = wanted.split('-')[0];
  return LOCALES.find((l) => l.code.toLowerCase().split('-')[0] === primary)?.code ?? null;
};

/**
 * Resolves a key against a locale, falling back to English and then to the key itself, and
 * substitutes `{name}` placeholders.
 *
 * Falling back to English rather than the raw key matters: a missing translation should read as
 * untranslated text, not as a leaked identifier.
 */
export function translate(
  locale: LocaleCode,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const template = DICTIONARIES[locale]?.[key] ?? en[key] ?? key;
  if (!vars) return template;

  return Object.entries(vars).reduce(
    (out, [name, value]) => out.replaceAll(`{${name}}`, String(value)),
    template,
  );
}
