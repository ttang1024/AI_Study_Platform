import { useCallback, useEffect, useRef, useState } from 'react';

import { courseService } from '@/services/courseService';
import {
  practiceService,
  type PracticeQuestion,
  type PracticeResultItem,
  type PracticeSource,
  type PracticeTestSummary,
} from '@/services/practiceService';
import type { Course } from '@/types';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { ALL_SOURCES, type Phase } from '@/components/practice/practiceMeta';

// State machine + actions behind the Practice screen. The screen and its three phase
// views (setup / running / report) are pure presentation over this view-model.
export function usePractice() {
  const [phase, setPhase] = useState<Phase>('setup');

  // ── config ──
  const [courses, setCourses] = useState<Course[]>([]);
  const [count, setCount] = useState(15);
  const [sources, setSources] = useState<Set<PracticeSource>>(new Set(ALL_SOURCES));
  const [courseId, setCourseId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [smartLoading, setSmartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── run state ──
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<PracticeResultItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [summary, setSummary] = useState<PracticeTestSummary | null>(null);
  const startRef = useRef(0);

  useStudyTimer({ contextType: 'practice', courseId: courseId || null, enabled: phase === 'running' });

  useEffect(() => {
    courseService.getCourses().then(setCourses).catch(() => {});
  }, []);

  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const toggleSource = useCallback((s: PracticeSource) => {
    setSources((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next.size === 0 ? prev : next; // keep at least one
    });
  }, []);

  const runTest = useCallback((test: { questions: PracticeQuestion[] }) => {
    setQuestions(test.questions);
    setIndex(0);
    setResults([]);
    setSelected(null);
    setRevealed(false);
    setElapsed(0);
    startRef.current = Date.now();
    setPhase('running');
  }, []);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const test = await practiceService.generate({ count, courseId: courseId ?? null, sources: [...sources] });
      if (test.questions.length === 0) {
        setError('No material found for that selection. Try adding sources or generating quizzes/flashcards first.');
        return;
      }
      runTest(test);
    } catch {
      setError('Couldn’t build a test right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [count, courseId, sources, runTest]);

  const startSmartSession = useCallback(async () => {
    setSmartLoading(true);
    setError(null);
    try {
      const test = await practiceService.generateSmartSession();
      if (test.questions.length === 0) {
        setError('Nothing due right now — no waiting reviews, open mistakes, or unmastered terms. Nice work!');
        return;
      }
      runTest(test);
    } catch {
      setError('Couldn’t build your smart session right now. Please try again.');
    } finally {
      setSmartLoading(false);
    }
  }, [runTest]);

  const current = questions[index];

  const grade = useCallback((isCorrect: boolean) => {
    setResults((prev) => [...prev, { source: current.source, sourceId: current.sourceId, isCorrect }]);
    setRevealed(true);
  }, [current]);

  const pickOption = useCallback((opt: string) => {
    if (revealed) return;
    setSelected(opt);
    grade(opt === current.answer);
  }, [revealed, current, grade]);

  const reveal = useCallback(() => setRevealed(true), []);

  const advance = useCallback(async (finalResults: PracticeResultItem[]) => {
    if (index + 1 < questions.length) {
      setIndex((i) => i + 1);
      setSelected(null);
      setRevealed(false);
      return;
    }
    setPhase('report');
    try {
      setSummary(await practiceService.submit(finalResults));
    } catch {
      // Even if persistence fails, show the locally-computed report.
      const correct = finalResults.filter((r) => r.isCorrect).length;
      setSummary({
        total: finalResults.length,
        correct,
        accuracyPercent: finalResults.length ? Math.round((correct * 1000) / finalResults.length) / 10 : 0,
      });
    }
  }, [index, questions.length]);

  const restart = useCallback(() => {
    setPhase('setup');
    setQuestions([]);
    setSummary(null);
    setResults([]);
  }, []);

  const graded = results.length > index;
  const isLast = index + 1 >= questions.length;

  return {
    phase,
    // config
    courses, count, setCount, sources, toggleSource, courseId, setCourseId,
    loading, smartLoading, error, start, startSmartSession,
    // run
    questions, index, current, results, selected, revealed, elapsed, graded, isLast,
    pickOption, grade, reveal, next: () => advance(results),
    // report
    summary, restart,
  };
}

export type UsePractice = ReturnType<typeof usePractice>;
