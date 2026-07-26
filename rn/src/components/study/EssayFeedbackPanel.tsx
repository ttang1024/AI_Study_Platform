import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ThumbsUp from 'lucide-react-native/icons/thumbs-up';
import Wrench from 'lucide-react-native/icons/wrench';

import { ProgressBar } from '@/components/ProgressBar';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import type { EssayFeedback } from '@/services/essayService';

interface Props {
  feedback: EssayFeedback;
  scorePercent?: number;
}

const bandColor = (percent: number): string =>
  percent >= 80 ? Colors.emerald : percent >= 60 ? Colors.amber : Colors.red;

/**
 * Rubric feedback on one draft.
 *
 * Every strength and improvement renders with the passage it refers to, because the grading prompt
 * requires a verbatim quotation for each. The quote is what makes the feedback checkable — a comment
 * the writer cannot locate in their own text is not actionable.
 */
export const EssayFeedbackPanel: React.FC<Props> = ({ feedback, scorePercent }) => (
  <View style={styles.container}>
    {(scorePercent !== undefined || !!feedback.overallComment) && (
      <View style={styles.overall}>
        {scorePercent !== undefined && (
          <Text style={[styles.score, { color: bandColor(scorePercent) }]}>{scorePercent}%</Text>
        )}
        {!!feedback.overallComment && <Text style={styles.body}>{feedback.overallComment}</Text>}
      </View>
    )}

    {!!feedback.criteria?.length && (
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>By criterion</Text>
        {feedback.criteria.map((c) => {
          const ratio = c.maxPoints > 0 ? Math.min(1, Math.max(0, c.score / c.maxPoints)) : 0;
          return (
            <View key={c.name} style={styles.criterion}>
              <View style={styles.criterionHeader}>
                <Text style={styles.criterionName}>{c.name}</Text>
                <Text style={styles.caption}>
                  {c.score} / {c.maxPoints}
                </Text>
              </View>
              <ProgressBar progress={ratio} color={ratio >= 0.6 ? Colors.emerald : Colors.red} />
              {!!c.comment && <Text style={styles.caption}>{c.comment}</Text>}
              {!!c.toImprove && (
                <Text style={styles.improve}>
                  <Text style={styles.improveLabel}>To improve: </Text>
                  {c.toImprove}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    )}

    {!!feedback.strengths?.length && (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThumbsUp size={13} color={Colors.textSecondary} />
          <Text style={styles.sectionLabel}>What worked</Text>
        </View>
        {feedback.strengths.map((s, i) => (
          <View key={i} style={styles.point}>
            <Text style={styles.body}>{s.point}</Text>
            {!!s.quote && (
              <Text style={[styles.quote, styles.quoteGood]}>“{s.quote}”</Text>
            )}
          </View>
        ))}
      </View>
    )}

    {!!feedback.improvements?.length && (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Wrench size={13} color={Colors.textSecondary} />
          <Text style={styles.sectionLabel}>What to change</Text>
        </View>
        {feedback.improvements.map((s, i) => (
          <View key={i} style={styles.point}>
            <Text style={styles.body}>{s.point}</Text>
            {!!s.quote && <Text style={[styles.quote, styles.quoteWarn]}>“{s.quote}”</Text>}
            {!!s.suggestion && <Text style={styles.improve}>{s.suggestion}</Text>}
          </View>
        ))}
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  overall: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  score: { ...Typography.title },
  body: { ...Typography.body, color: Colors.textPrimary, lineHeight: 21 },
  caption: { ...Typography.caption, color: Colors.textSecondary },
  section: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel: { ...Typography.captionBold, color: Colors.textSecondary, textTransform: 'uppercase' },
  criterion: {
    gap: 6,
    padding: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  criterionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  criterionName: { ...Typography.bodyBold, color: Colors.textPrimary },
  improve: { ...Typography.caption, color: Colors.primary },
  improveLabel: { fontWeight: '700' },
  point: { gap: 4 },
  quote: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    borderLeftWidth: 2,
    paddingLeft: Spacing.two,
  },
  quoteGood: { borderLeftColor: Colors.emerald },
  quoteWarn: { borderLeftColor: Colors.amber },
});

export default EssayFeedbackPanel;
