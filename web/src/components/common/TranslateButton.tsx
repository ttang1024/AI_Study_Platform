import React, { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { languageService } from '../../services/languageService';
import { useTranslation, LOCALES } from '../../i18n';
import { getApiErrorMessage } from '../../utils/apiError';

interface Props {
  /** The material to translate — usually a summary or a note body. */
  text: string;
  /** Receives the translation, or null when the user switches back to the original. */
  onTranslated: (translated: string | null) => void;
  className?: string;
}

/**
 * Translates a piece of study material on demand.
 *
 * Nothing is stored. A translation is a view of the material, not a second copy of it, and keeping
 * one per language per artifact would multiply the library while leaving every copy to drift when
 * the source is regenerated.
 */
export const TranslateButton: React.FC<Props> = ({ text, onTranslated, className = '' }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [showing, setShowing] = useState(false);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState<string>(
    // Defaults to the interface language, which is the one they are most likely to want.
    LOCALES.find((l) => l.code !== 'en')?.nativeName ?? 'Spanish',
  );

  const translate = async () => {
    if (showing) {
      setShowing(false);
      onTranslated(null);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const translated = await languageService.translate(text, language);
      if (translated) {
        onTranslated(translated);
        setShowing(true);
      } else {
        setError(t('translate.failed'));
      }
    } catch (e) {
      setError(getApiErrorMessage(e, t('translate.failed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {!showing && (
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="px-2 py-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] text-xs"
          aria-label={t('translate.into')}
        >
          {LOCALES.map((l) => (
            <option key={l.code} value={l.nativeName}>
              {l.nativeName}
            </option>
          ))}
        </select>
      )}

      <button
        onClick={() => void translate()}
        disabled={busy || !text.trim()}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--primary)] hover:opacity-80 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
        {busy ? t('translate.working') : showing ? 'Show original' : t('translate.action')}
      </button>

      {showing && <span className="text-xs text-text-muted">{t('translate.disclaimer')}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
};

export default TranslateButton;
