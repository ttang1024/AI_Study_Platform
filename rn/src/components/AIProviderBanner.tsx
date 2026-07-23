import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyRound from 'lucide-react-native/icons/key-round';
import X from 'lucide-react-native/icons/x';

import { Colors, Layout, Spacing } from '@/constants/theme';
import { aiSettingsService } from '@/services/aiSettingsService';

/**
 * A top banner shown across the app when no AI provider key is configured, so AI
 * features are known to fail. Mirrors web's AIProviderBanner (common/AIProviderBanner.tsx).
 * Re-checks on every settings save via aiSettingsService.onChange.
 */
export const AIProviderBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [missingKey, setMissingKey] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      aiSettingsService.getActiveKey().then((key) => {
        if (!cancelled) setMissingKey(!key);
      });
    };
    check();
    const unsubscribe = aiSettingsService.onChange(check);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (!missingKey || dismissed) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + Spacing.two }]}>
      <KeyRound size={15} color={Colors.white} />
      <Text style={styles.text}>No AI provider key set — AI features won&apos;t work.</Text>
      <Pressable onPress={() => router.push('/settings/ai-services')} hitSlop={8}>
        <Text style={styles.link}>Set up</Text>
      </Pressable>
      <Pressable onPress={() => setDismissed(true)} hitSlop={8} accessibilityLabel="Dismiss">
        <X size={16} color={Colors.white} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    ...Layout.row,
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    backgroundColor: Colors.amber,
  },
  text: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.white },
  link: { fontSize: 13, fontWeight: '800', color: Colors.white, textDecorationLine: 'underline' },
});
