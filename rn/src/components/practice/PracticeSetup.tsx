import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import Zap from 'lucide-react-native/icons/zap';

import { Button } from '@/components/Button';
import { FilterChip } from '@/components/FilterChip';
import { PressableScale } from '@/components/PressableScale';
import { Alpha, Colors, Gradients, Layout, Overlay, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { ALL_SOURCES, COUNT_OPTIONS, SOURCE_META } from '@/components/practice/practiceMeta';
import type { UsePractice } from '@/hooks/usePractice';

type Props = Pick<
  UsePractice,
  'courses' | 'count' | 'setCount' | 'sources' | 'toggleSource' | 'courseId' | 'setCourseId'
  | 'loading' | 'smartLoading' | 'error' | 'start' | 'startSmartSession'
>;

export function PracticeSetup({
  courses, count, setCount, sources, toggleSource, courseId, setCourseId,
  loading, smartLoading, error, start, startSmartSession,
}: Props) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.setupContent}>
      <Text style={styles.blurb}>One timed test, mixed from everything you’ve studied. Results feed your mastery and streak.</Text>

      <LinearGradient colors={Gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.smartCard}>
        <View style={styles.smartHeader}>
          <View style={styles.smartIcon}>
            <Zap size={18} color={Colors.white} />
          </View>
          <Text style={styles.smartTitle}>Daily smart session</Text>
        </View>
        <Text style={styles.smartDesc}>
          Due flashcard reviews, mistakes to redo, and weak concepts — auto-picked and interleaved into one short session.
        </Text>
        <PressableScale
          onPress={startSmartSession}
          disabled={smartLoading}
          style={styles.smartButton}
        >
          <Text style={styles.smartButtonText}>{smartLoading ? 'Building…' : 'Start now'}</Text>
        </PressableScale>
      </LinearGradient>

      <Text style={styles.sectionLabel}>Draw from</Text>
      <View style={styles.sourceGrid}>
        {ALL_SOURCES.map((s) => {
          const meta = SOURCE_META[s];
          const on = sources.has(s);
          const Icon = meta.icon;
          return (
            <Pressable
              key={s}
              onPress={() => toggleSource(s)}
              style={[styles.sourceCard, on ? styles.sourceCardOn : styles.sourceCardOff]}
            >
              <View style={styles.sourceCardTop}>
                <View style={[styles.sourceIconWrap, { backgroundColor: `${meta.color}${Alpha.tint}` }]}>
                  <Icon size={16} color={meta.color} />
                </View>
                <View style={[styles.checkDot, on && styles.checkDotOn]}>
                  {on && <Check size={11} color={Colors.primaryForeground} strokeWidth={3} />}
                </View>
              </View>
              <Text style={styles.sourceTitle}>{meta.label}</Text>
              <Text style={styles.sourceDesc}>{meta.desc}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Length</Text>
      <View style={styles.chipRow}>
        {COUNT_OPTIONS.map((n) => (
          <FilterChip key={n} label={String(n)} active={count === n} onPress={() => setCount(n)} />
        ))}
      </View>

      {courses.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Course</Text>
          <View style={styles.chipRow}>
            <FilterChip label="All courses" active={!courseId} onPress={() => setCourseId(undefined)} />
            {courses.map((c) => (
              <FilterChip key={c.id} label={c.name} active={courseId === c.id} onPress={() => setCourseId(c.id)} />
            ))}
          </View>
        </>
      )}

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <Button title={loading ? 'Building test…' : 'Start test'} onPress={start} disabled={loading} loading={loading} />
      <Text style={styles.footnote}>Correct answers update your mastery, FSRS schedule, and streak.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  setupContent: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
  blurb: { ...Typography.caption, color: Colors.textSecondary },
  sectionLabel: { ...Typography.captionBold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: Spacing.two },
  errorText: { ...Typography.caption, color: Colors.errorText },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  smartCard: { borderRadius: Radius.xl, padding: Spacing.three, gap: Spacing.two, ...Shadows.primaryGlow },
  smartHeader: { ...Layout.row, gap: Spacing.two },
  smartIcon: { width: 34, height: 34, borderRadius: Radius.md, backgroundColor: Overlay.glass, ...Layout.center },
  smartTitle: { ...Typography.bodyBold, color: Colors.white },
  smartDesc: { ...Typography.caption, color: Overlay.onGradientMuted, lineHeight: 18 },
  smartButton: { backgroundColor: Colors.white, borderRadius: Radius.pill, height: 42, ...Layout.center },
  smartButtonText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  sourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  sourceCard: {
    width: '48%', flexGrow: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.three, gap: 4, borderWidth: 2, ...Shadows.card,
  },
  sourceCardOn: { borderColor: Colors.primary },
  sourceCardOff: { borderColor: 'transparent', opacity: 0.65 },
  sourceCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  sourceIconWrap: { width: 36, height: 36, borderRadius: Radius.md, ...Layout.center },
  checkDot: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.zinc300,
    ...Layout.center,
  },
  checkDotOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sourceTitle: { ...Typography.captionBold, fontSize: 13, color: Colors.textPrimary },
  sourceDesc: { fontSize: 11, lineHeight: 15, color: Colors.textSecondary },
  footnote: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
});
