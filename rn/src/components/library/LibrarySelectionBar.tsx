import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import FolderOpen from 'lucide-react-native/icons/folder-open';
import X from 'lucide-react-native/icons/x';

import { Colors, Layout, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

interface Props {
  count: number;
  onAssign: () => void;
  onClear: () => void;
}

/**
 * The bulk action bar shown while the library list is in selection mode. It floats above the
 * list rather than sitting in the header so it stays reachable with a thumb while scrolling.
 */
export const LibrarySelectionBar: React.FC<Props> = ({ count, onAssign, onClear }) => {
  if (count === 0) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        <Text style={styles.count}>{count} selected</Text>
        <Pressable style={styles.assignButton} onPress={onAssign}>
          <FolderOpen size={14} color={Colors.primaryForeground} />
          <Text style={styles.assignText}>Add to collection</Text>
        </Pressable>
        <Pressable onPress={onClear} hitSlop={8} accessibilityLabel="Clear selection">
          <X size={16} color={Colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 0, right: 0, bottom: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  bar: {
    ...Layout.rowBetween, gap: Spacing.two,
    backgroundColor: Colors.bgSidebar, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three, paddingVertical: 10,
    ...Shadows.card,
  },
  count: { ...Typography.captionBold, color: Colors.textPrimary },
  assignButton: {
    ...Layout.row, gap: 6,
    backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three, paddingVertical: 8,
  },
  assignText: { ...Typography.captionBold, color: Colors.primaryForeground },
});
