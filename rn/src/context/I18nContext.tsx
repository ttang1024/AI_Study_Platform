import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { LOCALES, isLocale, translate, type LocaleCode, type TranslationKey } from '@core/i18n';

export { LOCALES };
export type { LocaleCode, TranslationKey };

const STORAGE_KEY = 'sp_locale';

interface I18nContextValue {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Interface language.
 *
 * Starts from the device's language rather than English so the first frame is already right for
 * most users, then swaps in a stored preference once AsyncStorage answers. AsyncStorage is async, so
 * a stored non-default choice does briefly show the device language — reading it synchronously is
 * not possible, and blocking first paint on storage would be the worse trade.
 */
export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<LocaleCode>(() => {
    const device = Localization.getLocales()[0]?.languageCode;
    return isLocale(device) ? device : 'en';
  });

  useEffect(() => {
    void (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (isLocale(stored)) setLocaleState(stored);
    })();
  }, []);

  const setLocale = useCallback((next: LocaleCode) => {
    setLocaleState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
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
