import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import Medal from 'lucide-react-native/icons/medal';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FilterChip } from '@/components/FilterChip';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { studyGroupService, type LeaderboardEntry } from '@/services/studyGroupService';

const MEDAL_COLORS = [Colors.amber, Colors.silver, Colors.bronze];

export const LeaderboardTab: React.FC<{ groupId: string }> = ({ groupId }) => {
  const [days, setDays] = useState<7 | 30>(7);

  // Stores which (group, window) the rows belong to rather than blanking them in an effect.
  // Deriving during render is what makes switching windows show the spinner immediately without a
  // reset-then-fetch pass, and the cancel flag stops a slow 7-day response from landing after the
  // user has already switched to 30.
  const [loaded, setLoaded] = useState<{ key: string; entries: LeaderboardEntry[] } | null>(null);
  const key = `${groupId}:${days}`;
  const entries = loaded?.key === key ? loaded.entries : null;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await studyGroupService.getLeaderboard(groupId, days);
      if (!cancelled) setLoaded({ key: `${groupId}:${days}`, entries: result.entries });
    })();

    return () => {
      cancelled = true;
    };
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
  row: { ...Layout.row, gap: Spacing.three },
  // Opaque mint (primary wash over white) — Card carries elevation, and Android
  // elevation shadows render wrong behind translucent backgrounds.
  rowMe: { borderWidth: 1, borderColor: Colors.primary, backgroundColor: '#f2faf7' },
  rank: { ...Typography.bodyBold, color: Colors.textSecondary, width: 32 },
  body: { flex: 1 },
  name: { ...Typography.bodyBold, color: Colors.textPrimary },
  meta: { ...Typography.caption, color: Colors.textSecondary },
  xp: { ...Typography.bodyBold, color: Colors.primary },
});
