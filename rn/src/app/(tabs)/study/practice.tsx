import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Award, BookMarked, BrainCircuit, Check, Clock, Eye, RotateCcw, Sigma, X, Zap,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FilterChip } from '@/components/FilterChip';
import { ProgressBar } from '@/components/ProgressBar';
import { Alpha, Colors, Gradients, Overlay, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { courseService } from '@/services/courseService';
import {
  practiceService, type PracticeQuestion, type PracticeResultItem, type PracticeSource, type PracticeTestSummary,
} from '@/services/practiceService';
import type { Course } from '@/types';

// Mirrors web's components/practice/practiceMeta.ts.
const SOURCE_META: Record<PracticeSource, { label: string; desc: string; icon: LucideIcon; color: string }> = {
  quiz: { label: 'Quiz bank', desc: 'Multiple choice, auto-graded', icon: Award, color: Colors.amber },
  flashcard: { label: 'Flashcards', desc: 'Front → back recall', icon: BrainCircuit, color: Colors.teal },
  glossary: { label: 'Glossary', desc: 'Term → definition', icon: BookMarked, color: Colors.blue },
  problem: { label: 'Worked problems', desc: 'Solve & self-check', icon: Sigma, color: Colors.purple },
  mistake: { label: 'Mistake redo', desc: 'Questions you previously missed', icon: RotateCcw, color: Colors.red },
};
// The configurable test draws from these; 'mistake' only appears inside smart sessions.
const ALL_SOURCES: PracticeSource[] = ['quiz', 'flashcard', 'glossary', 'problem'];
const COUNT_OPTIONS = [10, 15, 25, 40];

// Chart flashcards store a chart-spec JSON as their answer — RN has no chart renderer,
// so degrade to a placeholder (same policy as utils/flashcardDisplay.ts).
const isChartAnswer = (answer: string) => {
  if (!answer.trimStart().startsWith('{')) return false;
  try {
    const parsed = JSON.parse(answer);
    return !!(parsed?.labels && parsed?.datasets);
  } catch {
    return false;
  }
};

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

type Phase = 'setup' | 'running' | 'report';

export default function PracticeScreen() {
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

  const toggleSource = (s: PracticeSource) => {
    setSources((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next.size === 0 ? prev : next; // keep at least one
    });
  };

  const runTest = (test: { questions: PracticeQuestion[] }) => {
    setQuestions(test.questions);
    setIndex(0);
    setResults([]);
    setSelected(null);
    setRevealed(false);
    setElapsed(0);
    startRef.current = Date.now();
    setPhase('running');
  };

  const start = async () => {
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
  };

  const startSmartSession = async () => {
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
  };

  const current = questions[index];

  const grade = (isCorrect: boolean) => {
    setResults((prev) => [...prev, { source: current.source, sourceId: current.sourceId, isCorrect }]);
    setRevealed(true);
  };

  const pickOption = (opt: string) => {
    if (revealed) return;
    setSelected(opt);
    grade(opt === current.answer);
  };

  const next = async (finalResults: PracticeResultItem[]) => {
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
  };

  const restart = () => {
    setPhase('setup');
    setQuestions([]);
    setSummary(null);
    setResults([]);
  };

  // ─── Setup ──────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.setupContent}>
        <Text style={styles.blurb}>One timed test, mixed from everything you’ve studied. Results feed your mastery and streak.</Text>

        <LinearGradient colors={Gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.smartCard}>
          <View style={styles.smartHeader}>
            <View style={styles.smartIcon}>
              <Zap size={18} color={Colors.white} />
            </View>
            <Text style={styles.smartTitle}>Daily smart session</Text>
          </View>
          <Text style={styles.smartDesc}>
            Due flashcard reviews, mistakes to redo, and weak concepts — auto-picked and interleaved into one short session.
          </Text>
          <Pressable
            onPress={startSmartSession}
            disabled={smartLoading}
            style={({ pressed }) => [styles.smartButton, (pressed || smartLoading) && styles.pressedDim]}
          >
            <Text style={styles.smartButtonText}>{smartLoading ? 'Building…' : 'Start now'}</Text>
          </Pressable>
        </LinearGradient>

        <Text style={styles.sectionLabel}>Draw from</Text>
        <View style={styles.sourceGrid}>
          {ALL_SOURCES.map((s) => {
            const meta = SOURCE_META[s];
            const on = sources.has(s);
            const Icon = meta.icon;
            return (
              <Pressable
                key={s}
                onPress={() => toggleSource(s)}
                style={[styles.sourceCard, on ? styles.sourceCardOn : styles.sourceCardOff]}
              >
                <View style={styles.sourceCardTop}>
                  <View style={[styles.sourceIconWrap, { backgroundColor: `${meta.color}${Alpha.tint}` }]}>
                    <Icon size={16} color={meta.color} />
                  </View>
                  <View style={[styles.checkDot, on && styles.checkDotOn]}>
                    {on && <Check size={11} color={Colors.primaryForeground} strokeWidth={3} />}
                  </View>
                </View>
                <Text style={styles.sourceTitle}>{meta.label}</Text>
                <Text style={styles.sourceDesc}>{meta.desc}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Length</Text>
        <View style={styles.chipRow}>
          {COUNT_OPTIONS.map((n) => (
            <FilterChip key={n} label={String(n)} active={count === n} onPress={() => setCount(n)} />
          ))}
        </View>

        {courses.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Course</Text>
            <View style={styles.chipRow}>
              <FilterChip label="All courses" active={!courseId} onPress={() => setCourseId(undefined)} />
              {courses.map((c) => (
                <FilterChip key={c.id} label={c.name} active={courseId === c.id} onPress={() => setCourseId(c.id)} />
              ))}
            </View>
          </>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <Button title={loading ? 'Building test…' : 'Start test'} onPress={start} disabled={loading} loading={loading} />
        <Text style={styles.footnote}>Correct answers update your mastery, FSRS schedule, and streak.</Text>
      </ScrollView>
    );
  }

  // ─── Report ─────────────────────────────────────────────────────────────
  if (phase === 'report') {
    const total = summary?.total ?? results.length;
    const correct = summary?.correct ?? results.filter((r) => r.isCorrect).length;
    const pct = summary?.accuracyPercent ?? (total ? Math.round((correct * 1000) / total) / 10 : 0);
    const missed = questions.filter((_, i) => results[i] && !results[i].isCorrect);
    const bySource = ALL_SOURCES.concat('mistake')
      .map((s) => {
        const items = results.filter((r) => r.source === s);
        return { s, total: items.length, correct: items.filter((r) => r.isCorrect).length };
      })
      .filter((x) => x.total > 0);

    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.reportContent}>
        <LinearGradient colors={Gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Your score</Text>
          <Text style={styles.scoreValue}>{pct}%</Text>
          <View style={styles.scoreStatsRow}>
            <View>
              <Text style={styles.scoreStatLabel}>Correct</Text>
              <Text style={styles.scoreStatValue}>{correct}/{total}</Text>
            </View>
            <View>
              <Text style={styles.scoreStatLabel}>Time</Text>
              <Text style={styles.scoreStatValue}>{formatTime(elapsed)}</Text>
            </View>
          </View>
        </LinearGradient>

        {bySource.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>By source</Text>
            {bySource.map(({ s, total: t, correct: c }) => {
              const meta = SOURCE_META[s];
              const Icon = meta.icon;
              return (
                <Card key={s} style={styles.bySourceCard}>
                  <View style={styles.bySourceHeader}>
                    <Icon size={15} color={meta.color} />
                    <Text style={styles.bySourceLabel}>{meta.label}</Text>
                    <Text style={styles.bySourceCount}>{c}/{t}</Text>
                  </View>
                  <ProgressBar progress={t ? c / t : 0} color={meta.color} height={6} />
                </Card>
              );
            })}
          </>
        )}

        {missed.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Review your misses · {missed.length}</Text>
            {missed.map((q) => (
              <Card key={q.id} style={[styles.missCard, { borderLeftColor: SOURCE_META[q.source].color }]}>
                <Text style={styles.missPrompt} numberOfLines={2}>{q.prompt}</Text>
                <Text style={styles.missAnswer} numberOfLines={2}>
                  Answer: {isChartAnswer(q.answer) ? 'chart card — review it in Flashcards' : q.answer}
                </Text>
              </Card>
            ))}
          </>
        )}

        <Button title="New test" onPress={restart} />
      </ScrollView>
    );
  }

  // ─── Running ────────────────────────────────────────────────────────────
  const meta = SOURCE_META[current.source];
  const SourceIcon = meta.icon;
  const graded = results.length > index;
  const isLast = index + 1 >= questions.length;

  return (
    <View style={styles.root}>
      <View style={styles.runHeader}>
        <View style={styles.runProgressBar}>
          <ProgressBar progress={index / questions.length} height={6} />
        </View>
        <Text style={styles.runHeaderText}>{index + 1}/{questions.length}</Text>
        <Clock size={13} color={Colors.textSecondary} />
        <Text style={styles.runHeaderText}>{formatTime(elapsed)}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.runScroll}>
        <Card style={styles.questionCard}>
          <View style={[styles.sourceBadge, { backgroundColor: `${meta.color}${Alpha.tint}` }]}>
            <SourceIcon size={12} color={meta.color} />
            <Text style={[styles.sourceBadgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>

          <Text style={styles.prompt}>{current.prompt}</Text>

          {current.format === 'mc' && current.options && (
            <View style={styles.optionList}>
              {current.options.map((opt) => {
                const isAnswer = opt === current.answer;
                const isPicked = opt === selected;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => pickOption(opt)}
                    disabled={revealed}
                    style={[
                      styles.option,
                      revealed && isAnswer && styles.optionCorrect,
                      revealed && isPicked && !isAnswer && styles.optionWrong,
                    ]}
                  >
                    <Text style={styles.optionText}>{opt}</Text>
                    {revealed && isAnswer && <Check size={15} color={Colors.emerald} />}
                    {revealed && isPicked && !isAnswer && <X size={15} color={Colors.red} />}
                  </Pressable>
                );
              })}
            </View>
          )}

          {current.format === 'recall' && (
            !revealed ? (
              <Pressable onPress={() => setRevealed(true)} style={styles.revealButton}>
                <Eye size={15} color={Colors.textSecondary} />
                <Text style={styles.revealButtonText}>Show answer</Text>
              </Pressable>
            ) : (
              <View style={styles.answerBox}>
                <Text style={styles.boxLabel}>Answer</Text>
                <Text style={styles.answerText}>
                  {isChartAnswer(current.answer)
                    ? 'Chart not supported on mobile yet — view this card on the web app.'
                    : current.answer}
                </Text>
              </View>
            )
          )}

          {revealed && !!current.explanation && (
            <View style={styles.explanationBox}>
              <Text style={styles.boxLabel}>Explanation</Text>
              <Text style={styles.explanationText}>{current.explanation}</Text>
            </View>
          )}
        </Card>
      </ScrollView>

      <View style={styles.actionBar}>
        {!revealed && (
          <Text style={styles.hintText}>
            {current.format === 'mc' ? 'Pick an answer to continue.' : 'Reveal the answer, then rate yourself.'}
          </Text>
        )}
        {revealed && current.format === 'recall' && !graded && (
          <View style={styles.gradeRow}>
            <Pressable onPress={() => grade(false)} style={({ pressed }) => [styles.missedButton, pressed && styles.pressedDim]}>
              <X size={15} color={Colors.red} />
              <Text style={styles.missedButtonText}>Missed it</Text>
            </Pressable>
            <Pressable onPress={() => grade(true)} style={({ pressed }) => [styles.gotItButton, pressed && styles.pressedDim]}>
              <Check size={15} color={Colors.primaryForeground} />
              <Text style={styles.gotItButtonText}>Got it</Text>
            </Pressable>
          </View>
        )}
        {graded && (
          <Button title={isLast ? 'Finish & see results' : 'Next question'} onPress={() => next(results)} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  pressedDim: { opacity: 0.85 },
  sectionLabel: { ...Typography.captionBold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: Spacing.two },
  errorText: { ...Typography.caption, color: Colors.errorText },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },

  // Setup
  setupContent: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
  blurb: { ...Typography.caption, color: Colors.textSecondary },
  smartCard: { borderRadius: Radius.xl, padding: Spacing.three, gap: Spacing.two, ...Shadows.primaryGlow },
  smartHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  smartIcon: { width: 34, height: 34, borderRadius: Radius.md, backgroundColor: Overlay.glass, alignItems: 'center', justifyContent: 'center' },
  smartTitle: { ...Typography.bodyBold, color: Colors.white },
  smartDesc: { ...Typography.caption, color: Overlay.onGradientMuted, lineHeight: 18 },
  smartButton: { backgroundColor: Colors.white, borderRadius: Radius.pill, height: 42, alignItems: 'center', justifyContent: 'center' },
  smartButtonText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  sourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  sourceCard: {
    width: '48%', flexGrow: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.three, gap: 4, borderWidth: 2, ...Shadows.card,
  },
  sourceCardOn: { borderColor: Colors.primary },
  sourceCardOff: { borderColor: 'transparent', opacity: 0.65 },
  sourceCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  sourceIconWrap: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  checkDot: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.zinc300,
    alignItems: 'center', justifyContent: 'center',
  },
  checkDotOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sourceTitle: { ...Typography.captionBold, fontSize: 13, color: Colors.textPrimary },
  sourceDesc: { fontSize: 11, lineHeight: 15, color: Colors.textSecondary },
  footnote: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },

  // Report
  reportContent: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
  scoreCard: { borderRadius: Radius.xl, padding: Spacing.four, gap: 4, ...Shadows.primaryGlow },
  scoreLabel: { ...Typography.captionBold, color: Overlay.onGradientMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  scoreValue: { fontSize: 52, fontWeight: '800', color: Colors.white, fontVariant: ['tabular-nums'] },
  scoreStatsRow: { flexDirection: 'row', gap: Spacing.five, marginTop: Spacing.two },
  scoreStatLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: Overlay.onGradientMuted },
  scoreStatValue: { fontSize: 20, fontWeight: '800', color: Colors.white, fontVariant: ['tabular-nums'] },
  bySourceCard: { gap: Spacing.two },
  bySourceHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  bySourceLabel: { ...Typography.captionBold, fontSize: 13, color: Colors.textPrimary, flex: 1 },
  bySourceCount: { ...Typography.captionBold, color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
  missCard: { gap: 4, borderLeftWidth: 4 },
  missPrompt: { ...Typography.captionBold, fontSize: 13, color: Colors.textPrimary },
  missAnswer: { ...Typography.caption, color: Colors.primary },

  // Running
  runHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, paddingBottom: Spacing.two },
  runProgressBar: { flex: 1 },
  runHeaderText: { ...Typography.captionBold, color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
  runScroll: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  questionCard: { gap: Spacing.two },
  sourceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill,
  },
  sourceBadgeText: { fontSize: 11, fontWeight: '700' },
  prompt: { ...Typography.subheading, color: Colors.textPrimary, lineHeight: 23 },
  optionList: { gap: Spacing.two },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    borderWidth: 2, borderColor: 'transparent', backgroundColor: Colors.bgApp,
    borderRadius: Radius.md, padding: Spacing.three,
  },
  optionCorrect: { borderColor: Colors.emerald, backgroundColor: `${Colors.emerald}${Alpha.wash}` },
  optionWrong: { borderColor: Colors.red, backgroundColor: `${Colors.red}${Alpha.wash}` },
  optionText: { ...Typography.body, fontSize: 14, color: Colors.textPrimary, flex: 1 },
  revealButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two,
    borderWidth: 2, borderColor: Colors.zinc300, borderStyle: 'dashed', borderRadius: Radius.md,
    paddingVertical: Spacing.three,
  },
  revealButtonText: { ...Typography.captionBold, fontSize: 13, color: Colors.textSecondary },
  answerBox: { backgroundColor: Colors.bgApp, borderRadius: Radius.md, padding: Spacing.three, gap: 4 },
  boxLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, color: Colors.textSecondary },
  answerText: { ...Typography.body, color: Colors.textPrimary },
  explanationBox: { backgroundColor: `${Colors.blue}${Alpha.wash}`, borderRadius: Radius.md, padding: Spacing.three, gap: 4 },
  explanationText: { ...Typography.caption, color: Colors.textPrimary, lineHeight: 18 },
  actionBar: { padding: Spacing.three, paddingTop: 0, gap: Spacing.two },
  hintText: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
  gradeRow: { flexDirection: 'row', gap: Spacing.two },
  missedButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 2, borderColor: `${Colors.red}${Alpha.strong}`, borderRadius: Radius.pill, height: 48,
  },
  missedButtonText: { fontSize: 15, fontWeight: '700', color: Colors.red },
  gotItButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.emerald, borderRadius: Radius.pill, height: 48,
  },
  gotItButtonText: { fontSize: 15, fontWeight: '700', color: Colors.primaryForeground },
});
