import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { Colors, Layout, Radius, Spacing } from '@/constants/theme';

interface SubTabOption<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

interface SubTabChipRowProps<T extends string> {
  options: SubTabOption<T>[];
  active: T;
  onChange: (id: T) => void;
}

// Shared by AudioForm and VideoForm's podcast/lecture and link/upload toggles —
// self-sized icon+label pills, distinct from SegmentedTabs' equal-width segments.
export function SubTabChipRow<T extends string>({ options, active, onChange }: SubTabChipRowProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = active === opt.id;
        return (
          <Pressable key={opt.id} style={[styles.chip, isActive && styles.chipActive]} onPress={() => onChange(opt.id)}>
            <Icon size={12} color={isActive ? Colors.primaryForeground : Colors.textSecondary} />
            <Text style={[styles.text, isActive && styles.textActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.one, alignSelf: 'flex-start', backgroundColor: Colors.bgApp, borderRadius: Radius.md, padding: 2 },
  chip: { ...Layout.row, gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.sm },
  chipActive: { backgroundColor: Colors.primary },
  text: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  textActive: { color: Colors.primaryForeground },
});
