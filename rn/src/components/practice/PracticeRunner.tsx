import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, Clock, Eye, X } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { PressableScale } from '@/components/PressableScale';
import { Alpha, Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import { formatTime, isChartAnswer, SOURCE_META } from '@/components/practice/practiceMeta';
import type { UsePractice } from '@/hooks/usePractice';

type Props = Pick<
  UsePractice,
  'current' | 'index' | 'questions' | 'selected' | 'revealed' | 'elapsed' | 'graded' | 'isLast'
  | 'pickOption' | 'grade' | 'reveal' | 'next'
>;

export function PracticeRunner({
  current, index, questions, selected, revealed, elapsed, graded, isLast,
  pickOption, grade, reveal, next,
}: Props) {
  const meta = SOURCE_META[current.source];
  const SourceIcon = meta.icon;

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
              <Pressable onPress={reveal} style={styles.revealButton}>
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
            <PressableScale onPress={() => grade(false)} style={styles.missedButton}>
              <X size={15} color={Colors.red} />
              <Text style={styles.missedButtonText}>Missed it</Text>
            </PressableScale>
            <PressableScale onPress={() => grade(true)} style={styles.gotItButton}>
              <Check size={15} color={Colors.primaryForeground} />
              <Text style={styles.gotItButtonText}>Got it</Text>
            </PressableScale>
          </View>
        )}
        {graded && (
          <Button title={isLast ? 'Finish & see results' : 'Next question'} onPress={next} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  runHeader: { ...Layout.row, gap: Spacing.two, padding: Spacing.three, paddingBottom: Spacing.two },
  runProgressBar: { flex: 1 },
  runHeaderText: { ...Typography.captionBold, color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
  runScroll: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  questionCard: { gap: Spacing.two },
  sourceBadge: {
    ...Layout.row, gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill,
  },
  sourceBadgeText: { fontSize: 11, fontWeight: '700' },
  prompt: { ...Typography.subheading, color: Colors.textPrimary, lineHeight: 23 },
  optionList: { gap: Spacing.two },
  option: {
    ...Layout.row, gap: Spacing.two,
    borderWidth: 2, borderColor: 'transparent', backgroundColor: Colors.bgApp,
    borderRadius: Radius.md, padding: Spacing.three,
  },
  optionCorrect: { borderColor: Colors.emerald, backgroundColor: `${Colors.emerald}${Alpha.wash}` },
  optionWrong: { borderColor: Colors.red, backgroundColor: `${Colors.red}${Alpha.wash}` },
  optionText: { ...Typography.body, fontSize: 14, color: Colors.textPrimary, flex: 1 },
  revealButton: {
    ...Layout.row, justifyContent: 'center', gap: Spacing.two,
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
    flex: 1, ...Layout.row, justifyContent: 'center', gap: 6,
    borderWidth: 2, borderColor: `${Colors.red}${Alpha.strong}`, borderRadius: Radius.pill, height: 48,
  },
  missedButtonText: { fontSize: 15, fontWeight: '700', color: Colors.red },
  gotItButton: {
    flex: 1, ...Layout.row, justifyContent: 'center', gap: 6,
    backgroundColor: Colors.emerald, borderRadius: Radius.pill, height: 48,
  },
  gotItButtonText: { fontSize: 15, fontWeight: '700', color: Colors.primaryForeground },
});
