import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { FilterChip } from '@/components/FilterChip';
import { ExamReview } from '@/components/study/ExamReview';
import { ExamRunning } from '@/components/study/ExamRunning';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { courseService } from '@/services/courseService';
import { plannerService, type MockExam, type MockExamResult } from '@/services/plannerService';
import type { Course } from '@/types';

const COUNT_OPTIONS = [5, 10, 15, 20];
type Phase = 'setup' | 'running' | 'results';

export default function MockExamScreen() {
  // Exams are timed against elapsed wall-clock — never let the screen sleep mid-exam.
  useKeepAwake();
  const { courseId: initialCourseId } = useLocalSearchParams<{ courseId?: string }>();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('setup');
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string | undefined>(initialCourseId || undefined);
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [exam, setExam] = useState<MockExam | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<MockExamResult | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    courseService.getCourses().then(setCourses).catch(() => {});
  }, []);

  const start = async () => {
    setLoading(true);
    try {
      const data = await plannerService.getMockExam(courseId, count);
      setExam(data);
      startedAtRef.current = Date.now();
      setPhase('running');
    } finally {
      setLoading(false);
    }
  };

  const next = async () => {
    if (!exam) return;
    if (index + 1 < exam.questions.length) {
      setIndex((i) => i + 1);
      return;
    }
    setSubmitting(true);
    try {
      const durationSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
      setResult(await plannerService.gradeMockExam(answers, durationSeconds));
      setPhase('results');
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === 'setup') {
    return (
      <View style={styles.root}>
        <Text style={styles.sectionLabel}>Course</Text>
        <View style={styles.chipRow}>
          <FilterChip label="All courses" active={!courseId} onPress={() => setCourseId(undefined)} />
          {courses.map((c) => (
            <FilterChip key={c.id} label={c.name} active={courseId === c.id} onPress={() => setCourseId(c.id)} />
          ))}
        </View>
        <Text style={styles.sectionLabel}>Question count</Text>
        <View style={styles.chipRow}>
          {COUNT_OPTIONS.map((n) => (
            <FilterChip key={n} label={String(n)} active={count === n} onPress={() => setCount(n)} />
          ))}
        </View>
        <Button title={loading ? 'Loading…' : 'Start Mock Exam'} onPress={start} disabled={loading} loading={loading} />
      </View>
    );
  }

  if (phase === 'results' && result) {
    return (
      <ExamReview
        score={result.score}
        total={result.total}
        items={result.items.map((item) => ({
          key: item.quizId,
          question: item.question,
          userAnswer: item.userAnswer,
          correct: item.correct,
          correctAnswer: item.correctAnswer,
          explanation: item.explanation,
        }))}
        onClose={() => router.back()}
      />
    );
  }

  if (!exam) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const current = exam.questions[index];
  const currentAnswer = answers[current.quizId];

  return (
    <ExamRunning
      current={current}
      index={index}
      total={exam.questions.length}
      currentAnswer={currentAnswer}
      onSelectOption={(opt) => setAnswers((prev) => ({ ...prev, [current.quizId]: opt }))}
      onNext={next}
      submitting={submitting}
      nextLabel="Next"
      submitLabel="Submit"
      busyLabel="Grading…"
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp, padding: Spacing.three, gap: Spacing.three },
  center: { ...Layout.fillCenter, backgroundColor: Colors.bgApp },
  sectionLabel: { ...Typography.captionBold, color: Colors.textSecondary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
