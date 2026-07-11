import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { LoadingScreen } from '@/components/LoadingScreen';
import { ProgressBar } from '@/components/ProgressBar';
import { Colors, Gradients, Overlay, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { statsService } from '@/services/statsService';
import { ACHIEVEMENTS } from '@/utils/achievements';
import type { UserStats } from '@/types';

const CATEGORY_COLORS: Record<string, string> = {
  flashcards: Colors.primary,
  quizzes: Colors.emerald,
  notes: Colors.amber,
  documents: Colors.teal,
};

export default function AchievementsScreen() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    statsService.getUserStats().then(setStats).catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Couldn’t load your stats right now.</Text>
      </View>
    );
  }

  if (!stats) {
    return <LoadingScreen />;
  }

  const all = ACHIEVEMENTS.map((a) => ({ ...a, unlocked: a.condition(stats) }));
  const unlockedCount = all.filter((a) => a.unlocked).length;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <LinearGradient colors={Gradients.amber} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.heroCount}>{unlockedCount} / {all.length}</Text>
        <Text style={styles.heroLabel}>achievements unlocked</Text>
        <ProgressBar
          progress={unlockedCount / all.length}
          color={Colors.white}
          trackColor={Overlay.glassStrong}
          height={8}
        />
      </LinearGradient>

      <View style={styles.grid}>
        {all.map((a) => (
          <View key={a.id} style={[styles.cell, a.unlocked ? styles.cellUnlocked : styles.cellLocked]}>
            <Text style={styles.icon}>{a.icon}</Text>
            <Text style={[styles.title, !a.unlocked && styles.titleLocked]}>{a.title}</Text>
            <Text style={styles.description}>{a.description}</Text>
            {a.unlocked && <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[a.category] }]} />}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgApp },
  errorText: { ...Typography.caption, color: Colors.textSecondary },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },
  hero: { borderRadius: Radius.xl, padding: Spacing.three, gap: Spacing.two, ...Shadows.card },
  heroCount: { ...Typography.title, color: Colors.white, fontVariant: ['tabular-nums'] },
  heroLabel: { ...Typography.captionBold, color: Overlay.onGradientMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: -Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cell: {
    width: '48%', flexGrow: 1, alignItems: 'center', gap: 4,
    borderRadius: Radius.lg, padding: Spacing.three,
  },
  cellUnlocked: { backgroundColor: Colors.bgCard, ...Shadows.card },
  cellLocked: { backgroundColor: Colors.bgSidebar, borderWidth: 1, borderColor: Colors.border, opacity: 0.55 },
  icon: { fontSize: 30 },
  title: { ...Typography.captionBold, fontSize: 13, color: Colors.textPrimary, textAlign: 'center' },
  titleLocked: { color: Colors.textSecondary },
  description: { fontSize: 11, lineHeight: 15, color: Colors.textSecondary, textAlign: 'center' },
  categoryDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4 },
});
