import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, ArrowRight } from 'lucide-react-native';

import { Alpha, Colors, Layout, Radius, Spacing } from '@/constants/theme';

interface DuplicateAlertProps {
  /** e.g. "article", "video", "podcast episode". */
  label: string;
  courseName: string;
  onView: () => void;
}

/** Amber "already exists" banner shown when a pasted link matches an existing library item. Mirrors web's DuplicateAlert. */
export function DuplicateAlert({ label, courseName, onView }: DuplicateAlertProps) {
  return (
    <View style={styles.root}>
      <AlertTriangle size={16} color={Colors.amber} />
      <View style={styles.body}>
        <Text style={styles.title}>This {label} already exists</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          Found in course: <Text style={styles.courseName}>{courseName}</Text>
        </Text>
      </View>
      <Pressable style={styles.viewButton} onPress={onView} hitSlop={6}>
        <Text style={styles.viewText}>View</Text>
        <ArrowRight size={12} color={Colors.amber} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...Layout.row,
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: `${Colors.amber}55`,
    backgroundColor: `${Colors.amber}${Alpha.tint}`,
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  courseName: { fontWeight: '700', color: Colors.textPrimary },
  viewButton: {
    ...Layout.row, gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.md, backgroundColor: `${Colors.amber}22`,
  },
  viewText: { fontSize: 12, fontWeight: '800', color: Colors.amber },
});
