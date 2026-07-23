import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { AnimatedNumber } from '@/components/AnimatedNumber';
import { IconBadge } from '@/components/IconBadge';
import { PressableScale } from '@/components/PressableScale';
import { Alpha, Colors, Layout, Overlay, Radius, Spacing, Typography } from '@/constants/theme';

// Small presentational pieces used only by the home dashboard — grouped in one
// file rather than split further since each is a handful of lines.

export const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.sectionRow}>
    <View style={styles.sectionAccent} />
    <Text style={styles.sectionLabel}>{label}</Text>
  </View>
);

// Rendered on the gradient hero card — frosted-glass tile with white text.
// `value` is pre-formatted (e.g. "12m"), so it isn't counted up; the tiles that
// show a bare count use `CountTile` below.
export const StatTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.statTile}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export const CountTile: React.FC<{ icon: LucideIcon; color?: string; label: string; value: number; onPress?: () => void }> = ({
  icon,
  color = Colors.primary,
  label,
  value,
  onPress,
}) => (
  <PressableScale
    style={[styles.countTile, { backgroundColor: `${color}${Alpha.wash}` }]}
    onPress={onPress}
    disabled={!onPress}
  >
    <IconBadge icon={icon} color={color} size={40} />
    <View style={styles.countTextBlock}>
      <AnimatedNumber value={value} style={styles.countValue} numberOfLines={1} />
      <Text style={styles.countLabel} numberOfLines={1}>{label}</Text>
    </View>
  </PressableScale>
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

export const DigestStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.digestStat}>
    <Text style={styles.digestStatValue}>{value}</Text>
    <Text style={styles.digestStatLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  sectionRow: { ...Layout.row, gap: 8, marginTop: Spacing.two, marginBottom: 2 },
  sectionAccent: { width: 4, height: 14, borderRadius: 2, backgroundColor: Colors.primary },
  sectionLabel: {
    ...Typography.captionBold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8,
  },

  statTile: {
    flexGrow: 1, flexBasis: '45%', backgroundColor: Overlay.glass, borderRadius: Radius.md, padding: Spacing.two,
    borderWidth: 1, borderColor: Overlay.glassBorder,
  },
  statValue: { ...Typography.heading, color: Colors.white },
  statLabel: { ...Typography.caption, color: Overlay.onGradientMuted },

  countTile: {
    flexGrow: 1, flexBasis: '45%', ...Layout.row, gap: Spacing.two,
    borderRadius: Radius.lg, padding: Spacing.three,
  },
  countTextBlock: { flex: 1, gap: 2 },
  countValue: { ...Typography.heading, color: Colors.textPrimary },
  countLabel: { ...Typography.caption, color: Colors.textSecondary },

  reinforceCard: {
    flex: 1, alignItems: 'center', gap: 4,
    borderRadius: Radius.lg, padding: Spacing.three,
  },
  reinforceValue: { ...Typography.heading },
  reinforceLabel: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },

  digestStat: { flexGrow: 1, flexBasis: '45%', backgroundColor: Colors.bgApp, borderRadius: Radius.md, padding: Spacing.two },
  digestStatValue: { ...Typography.bodyBold, color: Colors.textPrimary },
  digestStatLabel: { ...Typography.caption, color: Colors.textSecondary },
});
