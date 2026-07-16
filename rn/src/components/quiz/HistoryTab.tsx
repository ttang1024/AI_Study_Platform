import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, History } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { PressableScale } from '@/components/PressableScale';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import { quizHistoryService } from '@/services/quizHistoryService';
import { statsService } from '@/services/statsService';
import type { PendingMaterial, QuizSubmission, UserStats } from '@/types';

export const HistoryTab: React.FC = () => {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [pending, setPending] = useState<PendingMaterial[]>([]);
  const [generated, setGenerated] = useState<PendingMaterial[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      quizHistoryService.list(1, 30),
      quizHistoryService.getPendingMaterials(),
      quizHistoryService.getGeneratedMaterials(),
      statsService.getUserStats(),
    ]).then(([subs, pendingMaterials, generatedMaterials, userStats]) => {
      setSubmissions(subs.items);
      setPending(pendingMaterials);
      setGenerated(generatedMaterials);
      setStats(userStats);
    }).finally(() => setLoading(false));
  }, []);

  const openSubmission = useCallback((s: QuizSubmission) => {
    if (s.videoId) {
      router.push({ pathname: '/library/video/[id]', params: { id: s.videoId, tab: 'quiz' } }, { withAnchor: true });
    } else if (s.documentId && s.courseId) {
      router.push({ pathname: '/library/document/[id]', params: { id: s.documentId, courseId: s.courseId, tab: 'quiz' } }, { withAnchor: true });
    }
  }, [router]);

  const openMaterial = useCallback((m: PendingMaterial) => {
    if (m.kind === 'video') {
      router.push({ pathname: '/library/video/[id]', params: { id: m.id, tab: 'quiz' } }, { withAnchor: true });
    } else {
      router.push({ pathname: '/library/document/[id]', params: { id: m.id, courseId: m.courseId, tab: 'quiz' } }, { withAnchor: true });
    }
  }, [router]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      {!!stats && (
        <View style={styles.statRow}>
          <StatTile label="Avg score" value={`${Math.round(stats.achievements.averageQuizScore)}%`} />
          <StatTile label="Perfect quizzes" value={String(stats.achievements.perfectQuizzes)} />
          <StatTile label="Total taken" value={String(stats.totalQuizSubmissions)} />
        </View>
      )}

      <Text style={styles.sectionLabel}>Recent submissions</Text>
      {submissions.length === 0 ? (
        <EmptyState icon={History} title="No quizzes taken yet" subtitle="Take a quiz from a document or video to see it here." />
      ) : (
        submissions.map((s) => {
          const canOpen = !!s.videoId || (!!s.documentId && !!s.courseId);
          return (
            <ItemCard
              key={s.id}
              title={s.title ?? 'Quiz'}
              subtitle={`${s.score}/${s.total} · ${new Date(s.submittedAt).toLocaleDateString()}`}
              onPress={canOpen ? () => openSubmission(s) : undefined}
            />
          );
        })
      )}

      {generated.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Generated, not yet taken</Text>
          {generated.map((m) => (
            <ItemCard key={m.id} title={m.name} subtitle={m.courseName} onPress={() => openMaterial(m)} />
          ))}
        </>
      )}

      {pending.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Not yet quizzed ({pending.length})</Text>
          {pending.map((m) => (
            <ItemCard key={m.id} title={m.name} subtitle={m.courseName} onPress={() => openMaterial(m)} />
          ))}
        </>
      )}
    </ScrollView>
  );
};

const ItemCard: React.FC<{ title: string; subtitle: string; onPress?: () => void }> = ({ title, subtitle, onPress }) => (
  <PressableScale onPress={onPress} disabled={!onPress}>
    <Card style={styles.card}>
      <View style={styles.cardText}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {onPress && <ChevronRight size={18} color={Colors.textSecondary} />}
    </Card>
  </PressableScale>
);

const StatTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.statTile}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
  center: { ...Layout.fillCenter },
  statRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
  statTile: { flex: 1, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: Spacing.two, alignItems: 'center' },
  statValue: { ...Typography.heading, color: Colors.textPrimary },
  statLabel: { ...Typography.caption, color: Colors.textSecondary },
  sectionLabel: { ...Typography.subheading, color: Colors.textPrimary, marginTop: Spacing.two },
  pressed: { opacity: 0.7 },
  card: { ...Layout.row, gap: Spacing.two },
  cardText: { flex: 1, gap: 2 },
  title: { ...Typography.bodyBold, color: Colors.textPrimary },
  subtitle: { ...Typography.caption, color: Colors.textSecondary },
});
