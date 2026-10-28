import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedNumber } from '@/components/AnimatedNumber';
import { PressableScale } from '@/components/PressableScale';
import { Alpha, Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';

// Small presentational pieces used only by the home dashboard — grouped in one
// file rather than split further since each is a handful of lines.

export const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.sectionRow}>
    <View style={styles.sectionAccent} />
    <Text style={styles.sectionLabel}>{label}</Text>
  </View>
);

export const ReinforceCard: React.FC<{ label: string; value: number; color?: string; onPress: () => void }> = ({
  label,
  value,
  color = Colors.red,
  onPress,
}) => (
  <PressableScale
    style={[styles.reinforceCard, { backgroundColor: `${color}${Alpha.wash}` }]}
    onPress={onPress}
  >
    <AnimatedNumber value={value} style={[styles.reinforceValue, { color }]} />
    <Text style={styles.reinforceLabel}>{label}</Text>
  </PressableScale>
);

const styles = StyleSheet.create({
  sectionRow: { ...Layout.row, gap: 8, marginTop: Spacing.two, marginBottom: 2 },
  sectionAccent: { width: 4, height: 14, borderRadius: 2, backgroundColor: Colors.primary },
  sectionLabel: {
    ...Typography.captionBold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8,
  },

  reinforceCard: {
    flex: 1, alignItems: 'center', gap: 4,
    borderRadius: Radius.lg, padding: Spacing.three,
  },
  reinforceValue: { ...Typography.heading },
  reinforceLabel: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
});
