import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  LOCALES,
  isLocale,
  translate,
  type LocaleCode,
  type TranslationKey,
} from '@core/i18n';

export { LOCALES };
export type { LocaleCode, TranslationKey };

const STORAGE_KEY = 'sp_locale';

/**
 * Picks the starting locale: an explicit choice wins, then the browser's preference, then English.
 * Read synchronously at first render so the UI never flashes English before switching.
 */
const detectLocale = (): LocaleCode => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) return stored;

  const browser = navigator.language?.split('-')[0] ?? '';
  return isLocale(browser) ? browser : 'en';
};

interface I18nContextValue {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<LocaleCode>(detectLocale);

  useEffect(() => {
    // Keeps screen readers and CSS :lang() rules honest.
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: LocaleCode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useTranslation = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used inside an I18nProvider.');
  return context;
};
