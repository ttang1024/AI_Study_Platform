import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { Colors, Gradients, Layout, Radius, Shadows } from '@/constants/theme';

// Fixed pixel height (not derived from padding + text line-height) so the
// horizontal ScrollView wrapping these chips can be given an exact, matching
// height — an ambiguous/auto-sized ScrollView height causes RN's text layout
// to sometimes measure chip labels at 0 height (invisible or clipped text).
export const CHIP_HEIGHT = 34;

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: LucideIcon;
}

// Active and inactive states share one Pressable that owns the fixed size and
// border, with the gradient as an absolute-fill background. Swapping between
// separate active/inactive trees remounted the chip (the gradient measures in
// a frame late, momentarily collapsing its height) and toggled the 1px border,
// shifting neighboring chips — visible jitter on every tab switch.
export const FilterChip: React.FC<FilterChipProps> = ({ label, active, onPress, icon: Icon }) => (
  <Pressable
    onPress={onPress}
    style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
  >
    {active && (
      <LinearGradient
        colors={Gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientFill}
      />
    )}
    {!!Icon && <Icon size={13} color={active ? Colors.primaryForeground : Colors.textSecondary} />}
    <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  chip: {
    ...Layout.row,
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: CHIP_HEIGHT,
    // Constant border width in both states — only the color changes — so
    // toggling a chip never changes its measured width.
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  chipInactive: {
    backgroundColor: Colors.bgSidebar,
    borderColor: Colors.border,
  },
  chipActive: {
    // Opaque fill (under the gradient) keeps Android elevation shadows correct
    // and shows brand color on the first frame, before the gradient paints.
    backgroundColor: Colors.primary,
    borderColor: 'transparent',
    ...Shadows.primaryGlow,
  },
  // -1 offsets extend the fill over the (transparent) 1px border so the
  // active pill paints at exactly the same size as the inactive one.
  gradientFill: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: Radius.pill,
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  textActive: {
    color: Colors.primaryForeground,
  },
});
