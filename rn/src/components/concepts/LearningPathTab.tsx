import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Route from 'lucide-react-native/icons/route';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import type { LearningPath } from '@/services/conceptLinksService';

const STATUS_COLOR: Record<string, string> = {
  next: Colors.primary,
  ready: Colors.emerald,
  blocked: Colors.textSecondary,
  mastered: Colors.amber,
};

export const LearningPathTab: React.FC<{ path: LearningPath }> = ({ path }) => {
  const router = useRouter();

  if (path.steps.length === 0) {
    return <EmptyState icon={Route} title="No learning path yet" subtitle="Add glossary terms across your courses to build a suggested learning order." />;
  }

  return (
    <View style={styles.root}>
      <Text style={styles.statsText}>{path.masteredCount} / {path.totalCount} mastered</Text>
      <FlatList
        data={path.steps}
        keyExtractor={(s) => s.termId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push('/study/glossary')}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.order}>{item.order}</Text>
                <Text style={styles.concept} numberOfLines={1}>{item.concept}</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLOR[item.status]}1a` }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.reason}>{item.reason}</Text>
              {item.prerequisites.length > 0 && (
                <View style={styles.prereqRow}>
                  {item.prerequisites.map((p) => (
                    <View key={p} style={styles.prereqChip}>
                      <Text style={styles.prereqText}>{p}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  statsText: { ...Typography.caption, color: Colors.textSecondary, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  list: { padding: Spacing.three, gap: Spacing.two },
  card: { gap: 4 },
  row: { ...Layout.row, gap: Spacing.two },
  order: { ...Typography.captionBold, color: Colors.textSecondary, width: 20 },
  concept: { ...Typography.bodyBold, color: Colors.textPrimary, flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.lg },
  statusText: { ...Typography.captionBold, textTransform: 'uppercase', fontSize: 10 },
  reason: { ...Typography.caption, color: Colors.textSecondary },
  prereqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  prereqChip: { backgroundColor: Colors.bgApp, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  prereqText: { ...Typography.caption, color: Colors.textSecondary },
});
