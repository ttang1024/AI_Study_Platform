import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Medal } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FilterChip } from '@/components/FilterChip';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { studyGroupService, type LeaderboardEntry } from '@/services/studyGroupService';

const MEDAL_COLORS = [Colors.amber, Colors.silver, Colors.bronze];

export const LeaderboardTab: React.FC<{ groupId: string }> = ({ groupId }) => {
  const [days, setDays] = useState<7 | 30>(7);
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    setEntries(null);
    studyGroupService.getLeaderboard(groupId, days).then((result) => setEntries(result.entries));
  }, [groupId, days]);

  return (
    <View style={styles.root}>
      <View style={styles.filterRow}>
        <FilterChip label="7 days" active={days === 7} onPress={() => setDays(7)} />
        <FilterChip label="30 days" active={days === 30} onPress={() => setDays(30)} />
      </View>

      {entries === null ? (
        <ActivityIndicator style={styles.loading} color={Colors.primary} />
      ) : entries.length === 0 ? (
        <EmptyState icon={Medal} title="No activity yet" subtitle="Study minutes and quiz accuracy over this period will show up here." />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.userId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card style={[styles.row, item.isMe && styles.rowMe]}>
              <Text style={[styles.rank, item.rank <= 3 && { color: MEDAL_COLORS[item.rank - 1] }]}>#{item.rank}</Text>
              <View style={styles.body}>
                <Text style={styles.name}>{item.name}{item.isMe ? ' (you)' : ''}</Text>
                <Text style={styles.meta}>{item.studyMinutes}m · {item.quizCorrect}✓</Text>
              </View>
              <Text style={styles.xp}>{item.xp} XP</Text>
            </Card>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  filterRow: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, paddingBottom: 0 },
  loading: { marginTop: Spacing.five },
  list: { padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  // Opaque mint (primary wash over white) — Card carries elevation, and Android
  // elevation shadows render wrong behind translucent backgrounds.
  rowMe: { borderWidth: 1, borderColor: Colors.primary, backgroundColor: '#f2faf7' },
  rank: { ...Typography.bodyBold, color: Colors.textSecondary, width: 32 },
  body: { flex: 1 },
  name: { ...Typography.bodyBold, color: Colors.textPrimary },
  meta: { ...Typography.caption, color: Colors.textSecondary },
  xp: { ...Typography.bodyBold, color: Colors.primary },
});
