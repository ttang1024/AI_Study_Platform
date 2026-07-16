import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import type { KnowledgeGaps } from '@/services/conceptLinksService';

const SEVERITY_COLOR: Record<string, string> = {
  high: Colors.red,
  medium: Colors.amber,
  low: Colors.textSecondary,
};

export const GapsTab: React.FC<{ gaps: KnowledgeGaps }> = ({ gaps }) => {
  const router = useRouter();

  if (gaps.gaps.length === 0) {
    return <EmptyState icon={CheckCircle2} title="No gaps found" subtitle="Keep studying — this list fills in as you add more material." />;
  }

  return (
    <View style={styles.root}>
      <Text style={styles.statsText}>
        {gaps.stats.gaps} gap{gaps.stats.gaps === 1 ? '' : 's'} · {gaps.stats.unmastered} unmastered · {gaps.stats.undefined} undefined
      </Text>
      <FlatList
        data={gaps.gaps}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push('/study/glossary')}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <View style={[styles.dot, { backgroundColor: SEVERITY_COLOR[item.severity] ?? Colors.textSecondary }]} />
                <Text style={styles.concept}>{item.concept}</Text>
                <Text style={styles.refCount}>×{item.referenceCount}</Text>
              </View>
              <Text style={styles.reason}>{item.reason}</Text>
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
  dot: { width: 8, height: 8, borderRadius: 4 },
  concept: { ...Typography.bodyBold, color: Colors.textPrimary, flex: 1 },
  refCount: { ...Typography.caption, color: Colors.textSecondary },
  reason: { ...Typography.caption, color: Colors.textSecondary },
});
