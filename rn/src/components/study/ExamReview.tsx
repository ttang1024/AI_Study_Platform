import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Colors, Spacing, Typography } from '@/constants/theme';

export interface GradedExamItem {
  key: string;
  question: string;
  userAnswer: string | undefined;
  correct: boolean;
  correctAnswer: string;
  explanation?: string;
}

interface ExamReviewProps {
  score: number;
  total: number;
  /** Optional line under the score (e.g. "80% correct"). */
  subtitle?: string;
  items: GradedExamItem[];
  /** Extra sections between the review cards and the close button (e.g. battle standings). */
  children?: React.ReactNode;
  closeTitle?: string;
  onClose: () => void;
}

// Post-exam review shared by the timed exam, group battles, and planner mock
// exams: big score, one card per question with the user's answer graded, then
// any extra sections and a close button. Grading happens before this renders —
// client-side (timed exam) or server-side (battle/mock) both map to items.
export const ExamReview: React.FC<ExamReviewProps> = ({ score, total, subtitle, items, children, closeTitle = 'Done', onClose }) => (
  <ScrollView contentContainerStyle={styles.root}>
    <Text style={styles.score}>{score} / {total}</Text>
    {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

    {items.map((item) => (
      <Card key={item.key} style={styles.reviewCard}>
        <Text style={styles.reviewQuestion}>{item.question}</Text>
        <Text style={item.correct ? styles.reviewCorrect : styles.reviewWrong}>
          Your answer: {item.userAnswer ?? '(skipped)'}
        </Text>
        {!item.correct && <Text style={styles.reviewCorrect}>Correct: {item.correctAnswer}</Text>}
        {!!item.explanation && <Text style={styles.reviewExplanation}>{item.explanation}</Text>}
      </Card>
    ))}

    {children}

    <Button title={closeTitle} onPress={onClose} />
  </ScrollView>
);

const styles = StyleSheet.create({
  root: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
  score: { ...Typography.title, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.two },
  reviewCard: { gap: 4 },
  reviewQuestion: { ...Typography.bodyBold, color: Colors.textPrimary },
  reviewCorrect: { ...Typography.caption, color: Colors.emerald },
  reviewWrong: { ...Typography.caption, color: Colors.red },
  reviewExplanation: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic' },
});
