import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void; loading?: boolean };
  /** Wraps the block in a card surface. Off by default so full-page
   * empty states (list screens) keep blending into the page background. */
  bordered?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, subtitle, action, bordered }) => (
  <View style={[styles.root, bordered && styles.rootBordered]}>
    <LinearGradient
      colors={Gradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.iconCircle}
    >
      <Icon size={26} color={Colors.white} />
    </LinearGradient>
    <Text style={styles.title}>{title}</Text>
    {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    {!!action && (
      <Pressable
        style={({ pressed }) => [styles.actionShadow, pressed && styles.actionPressed]}
        onPress={action.onPress}
        disabled={action.loading}
      >
        <LinearGradient
          colors={Gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.action}
        >
          {action.loading && <ActivityIndicator size="small" color={Colors.primaryForeground} />}
          <Text style={styles.actionText}>{action.label}</Text>
        </LinearGradient>
      </Pressable>
    )}
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: Spacing.four, paddingVertical: Spacing.five },
  rootBordered: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, ...Shadows.card,
  },
  iconCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one,
    ...Shadows.primaryGlow,
  },
  title: { ...Typography.subheading, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { ...Typography.body, fontSize: 13, color: Colors.textSecondary, textAlign: 'center', maxWidth: 280 },
  actionShadow: { marginTop: Spacing.two, borderRadius: Radius.pill, ...Shadows.primaryGlow },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing.four, height: 42, borderRadius: Radius.pill,
  },
  actionPressed: { opacity: 0.85 },
  actionText: { fontSize: 14, fontWeight: '700', color: Colors.primaryForeground },
});
