import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { HelpCircle, Sparkles } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { PressableScale } from '@/components/PressableScale';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { Colors, Layout, Motion, Spacing, Typography } from '@/constants/theme';
import type { QuizQuestion } from '@/types';
import { haptics } from '@/utils/haptics';
import { isQuizOptionCorrect } from '@/utils/quizAnswers';
import { ConfidencePicker } from '@/components/quiz/ConfidencePicker';
import { QuizOption } from '@/components/quiz/QuizOption';

type Difficulty = 'easy' | 'medium' | 'hard';

// Shared by document- and video-quiz sections: same generate/answer/submit flow,
// only the underlying API calls differ (see DocumentQuizSection / VideoQuizSection).
interface QuizRunnerProps {
  getQuiz: (difficulty: Difficulty) => Promise<QuizQuestion[]>;
  generateQuiz: (difficulty: Difficulty) => Promise<QuizQuestion[]>;
  submitQuiz: (
    answers: Record<string, string>,
    score: number,
    total: number,
    confidence?: Record<string, number>,
  ) => Promise<unknown>;
}

/** Questions always carry the difficulty they were fetched for, which is what
 *  lets `loading` and `questions` below be derived rather than stored. */
interface Session {
  difficulty: Difficulty;
  questions: QuizQuestion[];
}

export const QuizRunner: React.FC<QuizRunnerProps> = ({ getQuiz, generateQuiz, submitQuiz }) => {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  /** {questionId: 1|2|3}. Sparse — rating is optional, and an unrated question must stay unrated. */
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  const [generating, setGenerating] = useState(false);

  // Derived, not stored: we're loading exactly while the questions we hold are
  // for a difficulty other than the selected one. Storing a `loading` flag meant
  // flipping it synchronously inside the fetch effect, which is a cascading
  // render (react-hooks/set-state-in-effect) — here the effect only ever sets
  // state from the promise callback.
  const stale = session?.difficulty !== difficulty;
  const loading = stale;
  const questions = stale ? [] : session.questions;

  const startSession = (next: Session) => {
    setSession(next);
    setAnswers({});
    setConfidence({});
    setSubmitted(false);
    setScore(null);
  };

  useEffect(() => {
    let cancelled = false;
    getQuiz(difficulty)
      .then((qs) => { if (!cancelled) startSession({ difficulty, questions: qs }); })
      .catch(() => { if (!cancelled) startSession({ difficulty, questions: [] }); });
    return () => { cancelled = true; };
  }, [getQuiz, difficulty]);

  const generate = async () => {
    setGenerating(true);
    try {
      // Resets the graded state too — otherwise "Retake Quiz" swapped in fresh
      // questions while `submitted` stayed true, rendering the new quiz already
      // marked up with the previous run's right/wrong colors.
      startSession({ difficulty, questions: await generateQuiz(difficulty) });
    } finally {
      setGenerating(false);
    }
  };

  const submit = async () => {
    const correct = questions.filter((q) => isQuizOptionCorrect(answers[q.id], q.correctAnswer)).length;
    if (correct === questions.length) haptics.success(); else haptics.warning();
    setScore({ correct, total: questions.length });
    setSubmitted(true);
    // Send nothing rather than an empty object when nothing was rated: the server treats absent as
    // "no data", and an empty map would be neither absent nor a rating.
    await submitQuiz(
      answers,
      correct,
      questions.length,
      Object.keys(confidence).length > 0 ? confidence : undefined,
    );
  };

  const allAnswered = questions.length > 0 && questions.every((q) => !!answers[q.id]);

  return (
    <View style={styles.root}>
      <SegmentedTabs
        value={difficulty}
        onChange={setDifficulty}
        options={[
          { value: 'easy', label: 'Easy' },
          { value: 'medium', label: 'Medium' },
          { value: 'hard', label: 'Hard' },
        ]}
      />

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.three }} />
      ) : questions.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="No Quiz Yet"
          subtitle={`Test yourself with ${difficulty} questions generated from this material.`}
          action={{ label: generating ? 'Generating…' : 'Generate Quiz', onPress: generate, loading: generating }}
          bordered
        />
      ) : (
        <View style={styles.questions}>
          {questions.map((q, i) => {
            const answer = answers[q.id];
            return (
              <View key={q.id} style={styles.questionCard}>
                <Text style={styles.questionText}>{i + 1}. {q.question}</Text>
                {(q.options ?? []).map((opt, optIndex) => {
                  const isSelected = answer === opt;
                  const isCorrectOption = submitted && isQuizOptionCorrect(opt, q.correctAnswer);
                  const isWrongPick = submitted && isSelected && !isCorrectOption;
                  const state = isCorrectOption ? 'correct'
                    : isWrongPick ? 'wrong'
                    : isSelected ? 'selected'
                    : 'idle';
                  return (
                    <QuizOption
                      key={opt}
                      label={opt}
                      index={optIndex}
                      state={state}
                      disabled={submitted}
                      onPress={() => {
                        haptics.tap();
                        setAnswers((prev) => ({ ...prev, [q.id]: opt }));
                      }}
                    />
                  );
                })}
                {/* Asked only once an answer is picked, and never after submitting: rating after the
                    result is revealed measures nothing. */}
                {!submitted && answer && (
                  <Animated.View entering={FadeIn.duration(Motion.duration.base)}>
                    <ConfidencePicker
                      value={confidence[q.id]}
                      onChange={(level) => setConfidence((prev) => ({ ...prev, [q.id]: level }))}
                    />
                  </Animated.View>
                )}
                {submitted && (
                  // Held back until the option colors have finished revealing, so
                  // the explanation doesn't give the answer away early.
                  <Animated.Text
                    entering={FadeInDown.delay(Motion.duration.base).duration(Motion.duration.base)}
                    style={styles.explanation}
                  >
                    {q.explanation}
                  </Animated.Text>
                )}
              </View>
            );
          })}

          {submitted && score ? (
            <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.resultBanner}>
              <Text style={styles.resultText}>{score.correct} / {score.total} correct</Text>
              <PressableScale onPress={generate} hitSlop={8}>
                <Text style={styles.retakeText}>Retake Quiz</Text>
              </PressableScale>
            </Animated.View>
          ) : (
            <Button title="Submit All Answers" onPress={submit} disabled={!allAnswered} />
          )}

          {!submitted && (
            <PressableScale style={styles.regenerateRow} onPress={generate} disabled={generating}>
              <Sparkles size={14} color={Colors.primary} />
              <Text style={styles.regenerateText}>{generating ? 'Generating…' : 'Regenerate'}</Text>
            </PressableScale>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  questions: { gap: Spacing.three },
  questionCard: { gap: Spacing.two },
  questionText: { ...Typography.bodyBold, color: Colors.textPrimary },
  explanation: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic' },
  resultBanner: { ...Layout.rowBetween },
  resultText: { ...Typography.bodyBold, color: Colors.textPrimary },
  retakeText: { ...Typography.captionBold, color: Colors.primary },
  regenerateRow: { ...Layout.row, gap: 4, justifyContent: 'center' },
  regenerateText: { ...Typography.caption, color: Colors.primary },
});
