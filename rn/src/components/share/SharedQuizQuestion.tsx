import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import X from 'lucide-react-native/icons/x';

import { Alpha, Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import type { ShareableQuiz } from '@/services/shareService';

/** Tap an option to check it — green/red feedback plus the explanation. */
export const SharedQuizQuestion: React.FC<{ index: number; question: ShareableQuiz }> = ({ index, question }) => {
  const [picked, setPicked] = useState<string | null>(null);
  const isCorrect = (option: string) =>
    option === question.correctAnswer
    || option.startsWith(`${question.correctAnswer}.`)
    || question.correctAnswer.startsWith(option[0] ?? '');
  return (
    <View style={styles.quizItem}>
      <Text style={styles.quizQuestion}>{index + 1}. {question.question}</Text>
      {(question.options ?? []).map((option) => {
        const chosen = picked === option;
        const showCorrect = picked !== null && isCorrect(option);
        const showWrong = chosen && !isCorrect(option);
        return (
          <Pressable
            key={option}
            style={[styles.quizOption, showCorrect && styles.quizOptionCorrect, showWrong && styles.quizOptionWrong]}
            onPress={() => setPicked(option)}
            disabled={picked !== null}
          >
            <Text style={styles.quizOptionText}>{option}</Text>
            {showCorrect && <Check size={14} color={Colors.emerald} />}
            {showWrong && <X size={14} color={Colors.red} />}
          </Pressable>
        );
      })}
      {picked !== null && !!question.explanation && (
        <Text style={styles.quizExplanation}>{question.explanation}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  quizItem: { gap: Spacing.one, paddingBottom: Spacing.two },
  quizQuestion: { ...Typography.bodyBold, color: Colors.textPrimary },
  quizOption: {
    ...Layout.rowBetween, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.two, paddingVertical: 10, backgroundColor: Colors.bgSidebar,
  },
  quizOptionCorrect: { borderColor: Colors.emerald, backgroundColor: `${Colors.emerald}${Alpha.tint}` },
  quizOptionWrong: { borderColor: Colors.red, backgroundColor: `${Colors.red}${Alpha.tint}` },
  quizOptionText: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  quizExplanation: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic' },
});
