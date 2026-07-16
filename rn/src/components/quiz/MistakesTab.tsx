import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { MistakeRow } from '@/components/quiz/MistakeRow';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { mistakesService } from '@/services/mistakesService';
import type { Mistake, QuizQuestion, VariantQuestion } from '@/types';
import { examSessionStore } from '@/utils/examSession';

type StatusFilter = 'open' | 'resolved' | 'all';

const RETRY_CAP = 50;

export const MistakesTab: React.FC = () => {
  const router = useRouter();
  const [filter, setFilter] = useState<StatusFilter>('open');
  const [items, setItems] = useState<Mistake[]>([]);
  const [counts, setCounts] = useState({ openCount: 0, resolvedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [variants, setVariants] = useState<Record<string, VariantQuestion[]>>({});
  const [variantsLoading, setVariantsLoading] = useState<Set<string>>(new Set());
  const [promoting, setPromoting] = useState(false);
  const [promoteNote, setPromoteNote] = useState<string | null>(null);
  const inflightRef = React.useRef<Record<string, Promise<VariantQuestion[]>>>({});

  // The spinner is switched on by the event handlers below (changeFilter/reload),
  // never synchronously inside the effect — `loading` starts true for the mount.
  const load = React.useCallback(async () => {
    try {
      const result = await mistakesService.getMistakes(filter === 'all' ? undefined : filter);
      setItems(result.items);
      setCounts({ openCount: result.openCount, resolvedCount: result.resolvedCount });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const reload = React.useCallback(() => {
    setLoading(true);
    return load();
  }, [load]);

  const changeFilter = useCallback((next: StatusFilter) => {
    setLoading(true);
    setFilter(next);
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const toggleStatus = useCallback(async (mistake: Mistake) => {
    const nextStatus = mistake.status === 'open' ? 'resolved' : 'open';
    await mistakesService.setStatus(mistake.id, nextStatus);
    reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await mistakesService.deleteMistake(id);
    setItems((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const loadVariants = useCallback(async (mistakeId: string) => {
    if (variants[mistakeId]) return;
    if (!inflightRef.current[mistakeId]) {
      setVariantsLoading((prev) => new Set(prev).add(mistakeId));
      inflightRef.current[mistakeId] = mistakesService.generateVariants(mistakeId);
    }
    try {
      const result = await inflightRef.current[mistakeId];
      setVariants((prev) => ({ ...prev, [mistakeId]: result }));
    } finally {
      delete inflightRef.current[mistakeId];
      setVariantsLoading((prev) => {
        const next = new Set(prev);
        next.delete(mistakeId);
        return next;
      });
    }
  }, [variants]);

  // Promoting hands the question to FSRS, which is what actually schedules repeat exposure —
  // a one-off "retry all" does not.
  const promoteToFlashcards = useCallback(async () => {
    setPromoting(true);
    setPromoteNote(null);
    try {
      const result = await mistakesService.promoteToFlashcards();
      setPromoteNote(
        result.created > 0
          ? `Added ${result.created} flashcard${result.created === 1 ? '' : 's'} — due for review now.`
          : 'Every open mistake already has a flashcard.',
      );
      reload(); // refresh so promoted rows show as cards
    } catch {
      setPromoteNote('Could not create flashcards.');
    } finally {
      setPromoting(false);
    }
  }, [reload]);

  const retryAllOpen = async () => {
    const result = await mistakesService.getMistakes('open');
    const questions: QuizQuestion[] = result.items.slice(0, RETRY_CAP).map((m) => ({
      id: m.id,
      documentId: m.documentId,
      videoId: m.videoId,
      sourceType: m.sourceType,
      question: m.question,
      options: m.options,
      correctAnswer: m.correctAnswer,
      explanation: m.explanation,
      difficulty: 'medium',
      createdAt: m.firstMissedAt,
    }));
    examSessionStore.set(questions, 'Retry Mistakes');
    router.push('/study/quizzes/timed-exam');
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SegmentedTabs
          value={filter}
          onChange={changeFilter}
          options={[
            { value: 'open', label: `Open (${counts.openCount})` },
            { value: 'resolved', label: `Resolved (${counts.resolvedCount})` },
            { value: 'all', label: 'All' },
          ]}
        />
        {counts.openCount > 0 && (
          <>
            <Button
              title="Make flashcards"
              variant="secondary"
              loading={promoting}
              onPress={promoteToFlashcards}
            />
            <Button title="Retry all open" variant="secondary" onPress={retryAllOpen} />
          </>
        )}
        {promoteNote && <Text style={styles.note}>{promoteNote}</Text>}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nothing here" subtitle="Wrong quiz answers show up here automatically and resolve when you answer them correctly." />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.map((mistake) => (
            <MistakeRow
              key={mistake.id}
              mistake={mistake}
              expanded={expandedId === mistake.id}
              variants={variants[mistake.id]}
              variantsLoading={variantsLoading.has(mistake.id)}
              onToggleExpand={toggleExpand}
              onToggleStatus={toggleStatus}
              onLoadVariants={loadVariants}
              onRemove={remove}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { ...Layout.fillCenter },
  header: { padding: Spacing.three, gap: Spacing.two },
  note: { ...Typography.caption, color: Colors.textSecondary },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two },
});
