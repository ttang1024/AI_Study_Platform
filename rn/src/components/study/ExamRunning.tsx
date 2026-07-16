import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Alpha, Colors, Radius, Spacing, Typography } from '@/constants/theme';

interface ExamRunningProps {
  current: { question: string; options?: string[] };
  index: number;
  total: number;
  /** Countdown display; omit for untimed runs (battles, mock exams). */
  secondsLeft?: number;
  currentAnswer: string | undefined;
  onSelectOption: (option: string) => void;
  onNext: () => void;
  /** Server-graded runs: disables the button and shows busyLabel while awaiting. */
  submitting?: boolean;
  nextLabel?: string;
  submitLabel?: string;
  busyLabel?: string;
}

// One-question-at-a-time exam runner shared by the timed exam, group battles,
// and planner mock exams. The parent owns index/answers state and decides what
// onNext does on the last question (client-side grade vs. server submit).
export const ExamRunning: React.FC<ExamRunningProps> = ({
  current, index, total, secondsLeft, currentAnswer, onSelectOption, onNext,
  submitting = false, nextLabel = 'Next Question', submitLabel = 'Submit Exam', busyLabel = 'Submitting…',
}) => (
  <View style={styles.root}>
    <View style={[styles.header, secondsLeft === undefined && styles.headerCentered]}>
      <Text style={styles.progressText}>{index + 1} / {total}</Text>
      {secondsLeft !== undefined && (
        <Text style={styles.timerText}>{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</Text>
      )}
    </View>

    <ScrollView contentContainerStyle={styles.questionScroll}>
      <Text style={styles.question}>{current.question}</Text>
      {(current.options ?? []).map((opt) => (
        <Pressable
          key={opt}
          style={[styles.option, currentAnswer === opt && styles.optionSelected]}
          onPress={() => onSelectOption(opt)}
        >
          <Text style={[styles.optionText, currentAnswer === opt && styles.optionTextSelected]}>{opt}</Text>
        </Pressable>
      ))}
    </ScrollView>

    <Button
      title={submitting ? busyLabel : index + 1 >= total ? submitLabel : nextLabel}
      onPress={onNext}
      disabled={!currentAnswer || submitting}
      loading={submitting}
    />
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp, padding: Spacing.three, gap: Spacing.three },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  headerCentered: { justifyContent: 'center' },
  progressText: { ...Typography.captionBold, color: Colors.textSecondary },
  timerText: { ...Typography.captionBold, color: Colors.red },
  questionScroll: { gap: Spacing.two, paddingBottom: Spacing.three },
  question: { ...Typography.heading, color: Colors.textPrimary, marginBottom: Spacing.two },
  option: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.three },
  optionSelected: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}${Alpha.wash}` },
  optionText: { ...Typography.body, color: Colors.textPrimary },
  optionTextSelected: { color: Colors.primary, fontWeight: '700' },
});
