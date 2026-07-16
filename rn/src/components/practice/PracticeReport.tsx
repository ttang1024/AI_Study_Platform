import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { Colors, Gradients, Layout, Overlay, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { buildReport, formatTime, isChartAnswer, SOURCE_META } from '@/components/practice/practiceMeta';
import type { UsePractice } from '@/hooks/usePractice';

type Props = Pick<UsePractice, 'summary' | 'results' | 'questions' | 'elapsed' | 'restart'>;

export function PracticeReport({ summary, results, questions, elapsed, restart }: Props) {
  const { total, correct, pct, missed, bySource } = buildReport(summary, results, questions);

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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  reportContent: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
  sectionLabel: { ...Typography.captionBold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: Spacing.two },
  scoreCard: { borderRadius: Radius.xl, padding: Spacing.four, gap: 4, ...Shadows.primaryGlow },
  scoreLabel: { ...Typography.captionBold, color: Overlay.onGradientMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  scoreValue: { fontSize: 52, fontWeight: '800', color: Colors.white, fontVariant: ['tabular-nums'] },
  scoreStatsRow: { flexDirection: 'row', gap: Spacing.five, marginTop: Spacing.two },
  scoreStatLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: Overlay.onGradientMuted },
  scoreStatValue: { fontSize: 20, fontWeight: '800', color: Colors.white, fontVariant: ['tabular-nums'] },
  bySourceCard: { gap: Spacing.two },
  bySourceHeader: { ...Layout.row, gap: Spacing.two },
  bySourceLabel: { ...Typography.captionBold, fontSize: 13, color: Colors.textPrimary, flex: 1 },
  bySourceCount: { ...Typography.captionBold, color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
  missCard: { gap: 4, borderLeftWidth: 4 },
  missPrompt: { ...Typography.captionBold, fontSize: 13, color: Colors.textPrimary },
  missAnswer: { ...Typography.caption, color: Colors.primary },
});
