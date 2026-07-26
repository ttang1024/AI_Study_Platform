import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import Check from 'lucide-react-native/icons/check';

import { Card } from '@/components/Card';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { LOCALES, useTranslation } from '@/context/I18nContext';

export default function LanguageSettingsScreen() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.caption}>{t('settings.languageHelp')}</Text>

      <Card style={styles.card}>
        {LOCALES.map((l) => (
          <Pressable key={l.code} style={styles.row} onPress={() => setLocale(l.code)}>
            {/* Written in each language's own script — a list in the reader's *current* language is
                useless to the person who cannot read it. */}
            <Text style={styles.name}>{l.nativeName}</Text>
            {locale === l.code && <Check size={18} color={Colors.primary} />}
          </Pressable>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.two },
  caption: { ...Typography.caption, color: Colors.textSecondary },
  card: { paddingVertical: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  name: { ...Typography.body, color: Colors.textPrimary },
});
