import { en, type TranslationKey } from './en';
import { es } from './es';

export { en, es };
export type { TranslationKey };

/**
 * Locales the interface is available in.
 *
 * `nativeName` is what a language switcher shows — a list written in the reader's *current*
 * language is useless to the person who cannot read it.
 */
export const LOCALES = [
  { code: 'en', nativeName: 'English' },
  { code: 'es', nativeName: 'Español' },
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];

export const DICTIONARIES: Record<LocaleCode, Partial<Record<TranslationKey, string>>> = { en, es };

export const isLocale = (value: string | null | undefined): value is LocaleCode =>
  value != null && LOCALES.some((l) => l.code === value);

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
