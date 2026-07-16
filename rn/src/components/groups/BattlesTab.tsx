import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Swords } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FilterChip } from '@/components/FilterChip';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { courseService } from '@/services/courseService';
import { studyGroupService, type Battle } from '@/services/studyGroupService';
import type { Course } from '@/types';

const COUNT_OPTIONS = [5, 10, 15];

export const BattlesTab: React.FC<{ groupId: string }> = ({ groupId }) => {
  const router = useRouter();
  const [battles, setBattles] = useState<Battle[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState<string | undefined>(undefined);
  const [count, setCount] = useState(10);

  const load = () => studyGroupService.listBattles(groupId).then(setBattles);

  useEffect(() => {
    load();
    courseService.getCourses().then(setCourses).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const create = async () => {
    setCreating(true);
    try {
      const battle = await studyGroupService.createBattle(groupId, { title: title.trim() || undefined, courseId, count });
      setShowForm(false);
      setTitle('');
      setBattles((prev) => (prev ? [battle, ...prev] : [battle]));
    } finally {
      setCreating(false);
    }
  };

  if (battles === null) {
    return <ActivityIndicator style={{ marginTop: Spacing.five }} color={Colors.primary} />;
  }

  return (
    <View style={styles.root}>
      {showForm ? (
        <Card style={styles.form}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Battle title (optional)"
            placeholderTextColor={Colors.textSecondary}
            style={styles.input}
          />
          <View style={styles.chipRow}>
            <FilterChip label="All courses" active={!courseId} onPress={() => setCourseId(undefined)} />
            {courses.map((c) => (
              <FilterChip key={c.id} label={c.name} active={courseId === c.id} onPress={() => setCourseId(c.id)} />
            ))}
          </View>
          <View style={styles.chipRow}>
            {COUNT_OPTIONS.map((n) => (
              <FilterChip key={n} label={`${n} questions`} active={count === n} onPress={() => setCount(n)} />
            ))}
          </View>
          <View style={styles.formActions}>
            <Pressable onPress={() => setShowForm(false)} disabled={creating}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Button title={creating ? 'Creating…' : 'Create Battle'} onPress={create} disabled={creating} loading={creating} />
          </View>
        </Card>
      ) : (
        <Button title="New Battle" onPress={() => setShowForm(true)} />
      )}

      {battles.length === 0 ? (
        <EmptyState icon={Swords} title="No battles yet" subtitle="Start one to challenge the group to the same quiz set." />
      ) : (
        battles.map((battle) => (
          <Card key={battle.id} style={styles.battleCard}>
            <Text style={styles.battleTitle}>{battle.title}</Text>
            <Text style={styles.battleMeta}>{battle.questionCount} questions · {battle.entries.length} played</Text>
            {battle.entries.slice(0, 3).map((entry) => (
              <Text key={entry.userId} style={styles.standingRow}>
                #{entry.rank} {entry.name}{entry.isMe ? ' (you)' : ''} — {entry.score}/{entry.total}
              </Text>
            ))}
            {!battle.iHavePlayed && (
              <Button title="Play" onPress={() => router.push(`/study/groups/battle/${battle.id}`)} />
            )}
          </Card>
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { padding: Spacing.three, gap: Spacing.two },
  form: { gap: Spacing.two },
  input: {
    ...Typography.body, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, padding: Spacing.two,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  formActions: { ...Layout.row, justifyContent: 'flex-end', gap: Spacing.three },
  cancelText: { ...Typography.captionBold, color: Colors.textSecondary },
  battleCard: { gap: 4 },
  battleTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  battleMeta: { ...Typography.caption, color: Colors.textSecondary },
  standingRow: { ...Typography.caption, color: Colors.textPrimary },
});
