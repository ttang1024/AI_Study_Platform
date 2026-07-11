import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { Square } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SearchBar } from '@/components/SearchBar';
import { QuestionBankRow } from '@/components/quiz/QuestionBankRow';
import { Colors, Spacing } from '@/constants/theme';
import { questionBankService } from '@/services/questionBankService';
import type { QuizQuestion } from '@/types';
import { examSessionStore } from '@/utils/examSession';
import { shuffle } from '@/utils/quizAnswers';

const PAGE_SIZE = 10;
const MOCK_EXAM_CAP = 50;

export const QuestionBankTab: React.FC = () => {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    questionBankService.list().then(setQuestions).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return questions;
    return questions.filter((item) => item.question.toLowerCase().includes(q));
  }, [questions, search]);

  const paged = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const startMockExam = () => {
    const chosen = questions.filter((q) => selected.has(q.id));
    const pool = shuffle(chosen.length > 0 ? chosen : filtered).slice(0, MOCK_EXAM_CAP);
    examSessionStore.set(pool, 'Mock Exam');
    router.push('/study/quizzes/timed-exam');
  };

  const saveEdit = useCallback(async (item: QuizQuestion, draft: { question: string; options: string[]; correctAnswer: string; explanation: string }) => {
    const updated = await questionBankService.update(item.id, { ...draft, difficulty: item.difficulty });
    setQuestions((prev) => prev.map((q) => (q.id === item.id ? updated : q)));
  }, []);

  const remove = useCallback(async (id: string) => {
    await questionBankService.remove(id);
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search questions…" />
        {selected.size > 0 && <Button title={`Mock Exam (${selected.size})`} onPress={startMockExam} />}
      </View>

      {filtered.length === 0 ? (
        <EmptyState icon={Square} title="No questions yet" subtitle="Generate a quiz from a document or video to populate your question bank." />
      ) : (
        <FlatList
          data={paged}
          keyExtractor={(q) => q.id}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={() => setPage((p) => (p * PAGE_SIZE < filtered.length ? p + 1 : p))}
          renderItem={({ item }) => (
            <QuestionBankRow
              item={item}
              expanded={expandedId === item.id}
              selected={selected.has(item.id)}
              onToggleExpand={toggleExpand}
              onToggleSelect={toggleSelect}
              onSave={saveEdit}
              onDelete={remove}
            />
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: Spacing.three, gap: Spacing.two },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two },
});
