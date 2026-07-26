import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Languages from 'lucide-react-native/icons/languages';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { LOCALES, useTranslation } from '@/context/I18nContext';
import { translationService } from '@/services/translationService';

interface Props {
  /** The material to translate — usually a summary. */
  text: string;
  /** Receives the translation, or null when the reader switches back to the original. */
  onTranslated: (translated: string | null) => void;
}

/**
 * Translates a piece of study material on demand.
 *
 * Nothing is stored. A translation is a view of the material, not a second copy — keeping one per
 * language per artifact would multiply the library and leave every copy to drift the moment the
 * source is regenerated.
 */
export const TranslateButton: React.FC<Props> = ({ text, onTranslated }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [showing, setShowing] = useState(false);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState<string>(
    LOCALES.find((l) => l.code !== 'en')?.nativeName ?? 'Spanish',
  );

  const run = async () => {
    if (showing) {
      setShowing(false);
      onTranslated(null);
      return;
    }

    setBusy(true);
    setError('');
    try {
      onTranslated(await translationService.translate(text, language));
      setShowing(true);
    } catch {
      setError(t('translate.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      {!showing && (
        <View style={styles.languages}>
          {LOCALES.map((l) => (
            <Pressable
              key={l.code}
              onPress={() => setLanguage(l.nativeName)}
              style={[styles.chip, language === l.nativeName && styles.chipActive]}
            >
              <Text style={[styles.chipText, language === l.nativeName && styles.chipTextActive]}>
                {l.nativeName}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable onPress={run} disabled={busy || !text.trim()} style={styles.action} hitSlop={8}>
        {busy ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Languages size={14} color={Colors.primary} />
        )}
        <Text style={styles.actionText}>
          {busy ? t('translate.working') : showing ? 'Show original' : t('translate.action')}
        </Text>
      </Pressable>

      {showing && <Text style={styles.caption}>{t('translate.disclaimer')}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: Spacing.one, marginTop: Spacing.two },
  languages: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.caption, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white, fontWeight: '700' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
  caption: { ...Typography.caption, color: Colors.textSecondary },
  error: { ...Typography.caption, color: Colors.red },
});

export default TranslateButton;
