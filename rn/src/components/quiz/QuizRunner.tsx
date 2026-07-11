import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { HelpCircle, Sparkles } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import type { QuizQuestion } from '@/types';
import { haptics } from '@/utils/haptics';
import { isQuizOptionCorrect } from '@/utils/quizAnswers';

type Difficulty = 'easy' | 'medium' | 'hard';

// Shared by document- and video-quiz sections: same generate/answer/submit flow,
// only the underlying API calls differ (see DocumentQuizSection / VideoQuizSection).
interface QuizRunnerProps {
  getQuiz: (difficulty: Difficulty) => Promise<QuizQuestion[]>;
  generateQuiz: (difficulty: Difficulty) => Promise<QuizQuestion[]>;
  submitQuiz: (answers: Record<string, string>, score: number, total: number) => Promise<unknown>;
}

export const QuizRunner: React.FC<QuizRunnerProps> = ({ getQuiz, generateQuiz, submitQuiz }) => {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setSubmitted(false);
    setAnswers({});
    setScore(null);
    try {
      setQuestions(await getQuiz(difficulty));
    } finally {
      setLoading(false);
    }
  }, [getQuiz, difficulty]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      setQuestions(await generateQuiz(difficulty));
    } finally {
      setGenerating(false);
    }
  };

  const submit = async () => {
    const correct = questions.filter((q) => isQuizOptionCorrect(answers[q.id], q.correctAnswer)).length;
    if (correct === questions.length) haptics.success(); else haptics.warning();
    setScore({ correct, total: questions.length });
    setSubmitted(true);
    await submitQuiz(answers, correct, questions.length);
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
                {q.options.map((opt) => {
                  const isSelected = answer === opt;
                  const isCorrectOption = submitted && isQuizOptionCorrect(opt, q.correctAnswer);
                  const isWrongPick = submitted && isSelected && !isCorrectOption;
                  return (
                    <Pressable
                      key={opt}
                      style={[
                        styles.option,
                        isSelected && !submitted && styles.optionSelected,
                        isCorrectOption && styles.optionCorrect,
                        isWrongPick && styles.optionWrong,
                      ]}
                      onPress={() => {
                        if (submitted) return;
                        haptics.tap();
                        setAnswers((prev) => ({ ...prev, [q.id]: opt }));
                      }}
                      disabled={submitted}
                    >
                      <Text style={styles.optionText}>{opt}</Text>
                    </Pressable>
                  );
                })}
                {submitted && <Text style={styles.explanation}>{q.explanation}</Text>}
              </View>
            );
          })}

          {submitted && score ? (
            <View style={styles.resultBanner}>
              <Text style={styles.resultText}>{score.correct} / {score.total} correct</Text>
              <Pressable onPress={generate}>
                <Text style={styles.retakeText}>Retake Quiz</Text>
              </Pressable>
            </View>
          ) : (
            <Button title="Submit All Answers" onPress={submit} disabled={!allAnswered} />
          )}

          {!submitted && (
            <Pressable style={styles.regenerateRow} onPress={generate} disabled={generating}>
              <Sparkles size={14} color={Colors.primary} />
              <Text style={styles.regenerateText}>{generating ? 'Generating…' : 'Regenerate'}</Text>
            </Pressable>
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
  option: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.two },
  optionSelected: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}0d` },
  optionCorrect: { borderColor: Colors.emerald, backgroundColor: `${Colors.emerald}1a` },
  optionWrong: { borderColor: Colors.red, backgroundColor: `${Colors.red}1a` },
  optionText: { ...Typography.body, color: Colors.textPrimary },
  explanation: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic' },
  resultBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultText: { ...Typography.bodyBold, color: Colors.textPrimary },
  retakeText: { ...Typography.captionBold, color: Colors.primary },
  regenerateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' },
  regenerateText: { ...Typography.caption, color: Colors.primary },
});
