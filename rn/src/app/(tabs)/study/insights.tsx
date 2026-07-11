import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { Colors, Gradients, Overlay, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { analyticsService, type CourseMastery, type TimeOnTask, type DailyQuizAccuracy } from '@/services/analyticsService';
import { bucketAccuracy, bucketMinutes } from '@/utils/analyticsBuckets';

type RangeOption = '7' | '30' | '90';
const RANGES: { value: RangeOption; label: string }[] = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

const accuracyTint = (pct: number): string => {
  if (pct >= 80) return Colors.emerald;
  if (pct >= 50) return Colors.amber;
  return Colors.red;
};

export default function InsightsScreen() {
  const [rangeOption, setRangeOption] = useState<RangeOption>('30');
  const days = Number(rangeOption);
  const [timeOnTask, setTimeOnTask] = useState<TimeOnTask | null>(null);
  const [accuracy, setAccuracy] = useState<DailyQuizAccuracy[] | null>(null);
  const [mastery, setMastery] = useState<CourseMastery[] | null>(null);

  useEffect(() => {
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    setTimeOnTask(null);
    setAccuracy(null);
    Promise.all([
      analyticsService.getTimeOnTask(from),
      analyticsService.getQuizAccuracy(from),
    ]).then(([t, a]) => {
      setTimeOnTask(t);
      setAccuracy(a);
    });
  }, [days]);

  useEffect(() => {
    analyticsService.getCourseMastery().then(setMastery);
  }, []);

  const totalMinutes = timeOnTask ? Math.round(timeOnTask.totalSeconds / 60) : 0;
  const overallAccuracy = accuracy && accuracy.length > 0
    ? (() => {
        const totals = accuracy.reduce((acc, d) => ({ c: acc.c + d.correctAttempts, t: acc.t + d.totalAttempts }), { c: 0, t: 0 });
        return totals.t === 0 ? 0 : Math.round((totals.c / totals.t) * 100);
      })()
    : 0;
  const avgMastery = mastery && mastery.length > 0
    ? Math.round(mastery.reduce((sum, m) => sum + m.masteryScore, 0) / mastery.length)
    : 0;

  const topCourseTime = timeOnTask
    ? [...timeOnTask.byCourse].sort((a, b) => b.totalSeconds - a.totalSeconds).slice(0, 6)
    : [];
  const courseTimeTotal = topCourseTime.reduce((sum, c) => sum + c.totalSeconds, 0) || 1;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <SegmentedTabs value={rangeOption} onChange={setRangeOption} options={RANGES} />

      <LinearGradient colors={Gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
        <StatTile label="Time on task" value={`${totalMinutes}m`} />
        <StatTile label="Avg accuracy" value={`${overallAccuracy}%`} />
        <StatTile label="Avg mastery" value={`${avgMastery}%`} />
      </LinearGradient>

      <Card style={styles.chartCard}>
        <Text style={styles.sectionLabel}>Study activity</Text>
        {timeOnTask ? (
          <BarChart buckets={bucketMinutes(timeOnTask.daily, days)} valueLabel={(v) => `${v}m`} />
        ) : (
          <ActivityIndicator color={Colors.primary} style={{ height: 120 }} />
        )}
      </Card>

      <Card style={styles.chartCard}>
        <Text style={styles.sectionLabel}>Quiz accuracy</Text>
        {accuracy ? (
          <BarChart buckets={bucketAccuracy(accuracy, days)} colorFor={accuracyTint} valueLabel={(v) => `${v}%`} />
        ) : (
          <ActivityIndicator color={Colors.primary} style={{ height: 120 }} />
        )}
      </Card>

      {topCourseTime.length > 0 && (
        <Card style={styles.chartCard}>
          <Text style={styles.sectionLabel}>Time by course</Text>
          {topCourseTime.map((c) => (
            <View key={c.courseId ?? c.courseName} style={styles.courseTimeRow}>
              <View style={styles.courseTimeHeader}>
                <Text style={styles.courseTimeName} numberOfLines={1}>{c.courseName}</Text>
                <Text style={styles.courseTimeValue}>{Math.round(c.totalSeconds / 60)}m</Text>
              </View>
              <ProgressBar progress={c.totalSeconds / courseTimeTotal} color={c.courseColor ?? Colors.primary} />
            </View>
          ))}
        </Card>
      )}

      {mastery === null ? (
        <ActivityIndicator color={Colors.primary} />
      ) : mastery.length > 0 && (
        <Card style={styles.chartCard}>
          <Text style={styles.sectionLabel}>Course mastery</Text>
          {mastery.map((m) => (
            <View key={m.courseId} style={styles.masteryRow}>
              <View style={styles.courseTimeHeader}>
                <Text style={styles.courseTimeName} numberOfLines={1}>{m.courseName}</Text>
                <Text style={styles.courseTimeValue}>{Math.round(m.masteryScore)}%</Text>
              </View>
              <ProgressBar progress={m.masteryScore / 100} color={m.courseColor} />
              <View style={styles.componentRow}>
                {m.components.map((c) => (
                  <View key={c.label} style={styles.componentChip}>
                    <Text style={styles.componentChipText}>{c.label} {Math.round(c.score)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const StatTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.statTile}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },
  heroCard: { flexDirection: 'row', borderRadius: Radius.xl, padding: Spacing.three, ...Shadows.primaryGlow },
  statTile: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { ...Typography.heading, color: Colors.white, fontVariant: ['tabular-nums'] },
  statLabel: { ...Typography.caption, fontSize: 12, color: Overlay.onGradientMuted, textAlign: 'center' },
  chartCard: { gap: Spacing.two },
  sectionLabel: { ...Typography.subheading, color: Colors.textPrimary },
  courseTimeRow: { gap: 4 },
  courseTimeHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  courseTimeName: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  courseTimeValue: { ...Typography.bodyBold, color: Colors.textPrimary },
  masteryRow: { gap: 4, marginBottom: Spacing.two },
  componentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  componentChip: { backgroundColor: Colors.bgApp, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  componentChipText: { ...Typography.caption, color: Colors.textSecondary },
});
