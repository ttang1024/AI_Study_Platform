import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { CHIP_HEIGHT } from '@/components/FilterChip';
import { Colors, Gradients, Radius, Spacing } from '@/constants/theme';

export interface TabChipOption<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

interface TabChipRowProps<T extends string> {
  tabs: TabChipOption<T>[];
  active: T;
  onChange: (id: T) => void;
}

// Shared by document/[id].tsx and video/[id].tsx content-type tab rows — was
// previously two copies, one of which had drifted to hardcoded radii instead
// of the `Radius` tokens the other used.
//
// Always a single horizontal row (never wraps to a second line): once the
// chips overflow the screen width, the row itself becomes scrollable rather
// than pushing tab content down with a second row of buttons.
export function TabChipRow<T extends string>({ tabs, active, onChange }: TabChipRowProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={styles.rowContent}
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        // Active and inactive tabs share one Pressable with a fixed height and
        // constant border; the gradient is an absolute-fill background layer.
        // Swapping between separate active/inactive trees remounted the chip
        // (the gradient measures in a frame late, momentarily collapsing the
        // auto-sized row so content below jumped up) and toggling the 1px
        // border made the active chip 2px smaller than its neighbors.
        return (
          <Pressable
            key={t.id}
            style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
            onPress={() => onChange(t.id)}
          >
            {isActive && (
              <LinearGradient
                colors={Gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientFill}
              />
            )}
            <Icon size={14} color={isActive ? Colors.primaryForeground : Colors.textSecondary} />
            <Text style={[styles.text, isActive && styles.textActive]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Exact height (chip + bottom padding) so the row can never be re-measured
  // to a different height mid-switch — an auto-sized horizontal ScrollView is
  // what let the tab strip's height jitter and shift the content below it.
  // flexShrink 0 because ScrollView's base style has flexShrink 1, which lets
  // overflowing sibling content compress the row despite the fixed height.
  row: { flexGrow: 0, flexShrink: 0, height: CHIP_HEIGHT + Spacing.two },
  rowContent: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.one,
    paddingHorizontal: Spacing.three, paddingBottom: Spacing.two,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 0,
    paddingHorizontal: 14, height: CHIP_HEIGHT, borderRadius: Radius.pill,
    // Constant border width in both states — only the color changes — so
    // toggling a tab never changes its measured size.
    borderWidth: 1,
  },
  chipInactive: {
    backgroundColor: Colors.bgSidebar,
    borderColor: Colors.border,
  },
  chipActive: {
    // Opaque fill under the gradient: correct Android elevation behavior and
    // brand color on the first frame, before the gradient paints.
    backgroundColor: Colors.primary,
    borderColor: 'transparent',
  },
  // -1 offsets extend the fill over the (transparent) 1px border so the
  // active pill paints at exactly the same size as the inactive ones.
  gradientFill: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: Radius.pill,
  },
  text: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: Colors.textSecondary },
  textActive: { color: Colors.primaryForeground },
});
