import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { Alpha, Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import type { QuizQuestion } from '@/types';
import { haptics } from '@/utils/haptics';
import { isQuizOptionCorrect, stripQuizOptionPrefix } from '@/utils/quizAnswers';

interface AnswerableQuestionRowProps {
  question: QuizQuestion;
  expanded: boolean;
  /** The option string the user picked, or undefined while unanswered. */
  answer?: string;
  onToggleExpand: (id: string) => void;
  onAnswer: (id: string, option: string | null) => void;
}

// Course-workspace Artifacts row: tapping the question expands it into an
// answerable multiple-choice card (unlike QuestionBankRow, which is a manage/
// edit view that reveals the correct answer immediately). Memoized with state
// lifted to the pane so answering one row doesn't re-render the whole list.
export const AnswerableQuestionRow: React.FC<AnswerableQuestionRowProps> = React.memo(
  function AnswerableQuestionRow({ question, expanded, answer, onToggleExpand, onAnswer }) {
    const answered = !!answer;
    const gotItRight = answered && isQuizOptionCorrect(answer, question.correctAnswer);

    return (
      <Card style={styles.card}>
        <Pressable style={styles.header} onPress={() => onToggleExpand(question.id)}>
          <View style={styles.headerBody}>
            <Text style={styles.question} numberOfLines={expanded ? undefined : 2}>{question.question}</Text>
            <Text style={styles.meta}>
              {question.difficulty}{question.sourceName ? ` · ${question.sourceName}` : ''}
            </Text>
          </View>
          {expanded
            ? <ChevronUp size={18} color={Colors.textSecondary} />
            : <ChevronDown size={18} color={Colors.textSecondary} />}
        </Pressable>

        {expanded && (
          <View style={styles.options}>
            {(question.options ?? []).map((opt, i) => {
              const isCorrectOption = answered && isQuizOptionCorrect(opt, question.correctAnswer);
              const isWrongPick = answered && opt === answer && !isCorrectOption;
              return (
                <Pressable
                  key={i}
                  style={[styles.option, isCorrectOption && styles.optionCorrect, isWrongPick && styles.optionWrong]}
                  onPress={() => {
                    if (isQuizOptionCorrect(opt, question.correctAnswer)) haptics.success(); else haptics.error();
                    onAnswer(question.id, opt);
                  }}
                  disabled={answered}
                >
                  <Text style={[
                    styles.letter,
                    isCorrectOption && styles.letterCorrect,
                    isWrongPick && styles.letterWrong,
                  ]}>
                    {String.fromCharCode(65 + i)}
                  </Text>
                  <Text style={styles.optionText}>{stripQuizOptionPrefix(opt)}</Text>
                </Pressable>
              );
            })}

            {answered && (
              <>
                <View style={styles.feedbackRow}>
                  {gotItRight
                    ? <CheckCircle2 size={16} color={Colors.emerald} />
                    : <XCircle size={16} color={Colors.red} />}
                  <Text style={[styles.feedbackText, { color: gotItRight ? Colors.emerald : Colors.red }]}>
                    {gotItRight ? 'Correct' : 'Incorrect'}
                  </Text>
                </View>
                {!!question.explanation && <Text style={styles.explanation}>{question.explanation}</Text>}
                <Pressable onPress={() => onAnswer(question.id, null)} hitSlop={8}>
                  <Text style={styles.tryAgain}>Try again</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </Card>
    );
  },
);

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  header: { ...Layout.row, gap: Spacing.two },
  headerBody: { flex: 1 },
  question: { ...Typography.bodyBold, color: Colors.textPrimary },
  meta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  options: { gap: 6 },
  option: {
    ...Layout.row, gap: Spacing.two,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.two,
  },
  optionCorrect: { borderColor: Colors.emerald, backgroundColor: `${Colors.emerald}${Alpha.tint}` },
  optionWrong: { borderColor: Colors.red, backgroundColor: `${Colors.red}${Alpha.tint}` },
  letter: {
    ...Typography.captionBold, color: Colors.textSecondary,
    width: 22, height: 22, lineHeight: 22, textAlign: 'center',
    borderWidth: 1, borderColor: Colors.border, borderRadius: 11,
  },
  letterCorrect: { color: Colors.emerald, borderColor: Colors.emerald },
  letterWrong: { color: Colors.red, borderColor: Colors.red },
  optionText: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  feedbackRow: { ...Layout.row, gap: 6, marginTop: 2 },
  feedbackText: { ...Typography.captionBold },
  explanation: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic' },
  tryAgain: { ...Typography.captionBold, color: Colors.primary, marginTop: 2 },
});
