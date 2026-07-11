import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, BookOpen, FileText, Flame, Globe, Layers, Mic, Sparkles, Target, TrendingUp, Video, Zap } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { IconBadge } from '@/components/IconBadge';
import { ProgressBar } from '@/components/ProgressBar';
import { CountTile, DigestStat, ReinforceCard, SectionLabel, StatTile } from '@/components/home/DashboardTiles';
import { HomeSkeleton } from '@/components/home/HomeSkeleton';
import { StudyCalendar } from '@/components/study/StudyCalendar';
import { Colors, Gradients, Overlay, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { TodayPlanItem } from '@/types';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// Today-plan items carry a web route in `url`; RN has its own route tree, so map
// by `type` instead of trying to parse/rewrite the web URL string.
const routeForItem = (item: TodayPlanItem | undefined): string => {
  switch (item?.type) {
    case 'flashcards':
      return '/study/flashcards';
    case 'quiz':
    case 'gap':
    case 'problems':
      return '/study/quizzes';
    case 'glossary':
      return '/study/glossary';
    default:
      return '/library';
  }
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { data, loading, refreshing, reload } = useDashboardData();

  if (loading || !data) {
    return <HomeSkeleton />;
  }

  const { today, summary, stats, xp, digest } = data;
  const focusLeft = Math.max(0, today.dailyGoalMinutes - today.todayMinutes);
  const primaryItem = today.items[0];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.three }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={Colors.primary} />}
    >
      <Text style={styles.eyebrow}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
      <Text style={styles.greeting}>{greeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</Text>

      <LinearGradient colors={Gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.heroLabel}>Today&apos;s progress</Text>
            <Text style={styles.heroPercent}>{Math.round(today.completionPercent)}%</Text>
          </View>
          <View style={styles.streakBadge}>
            <Flame size={16} color={Colors.white} />
            <View>
              <Text style={styles.streakText}>{today.streak.currentStreak} day streak</Text>
              {today.streak.longestStreak > today.streak.currentStreak && (
                <Text style={styles.streakBest}>Best: {today.streak.longestStreak} days</Text>
              )}
            </View>
          </View>
        </View>
        <ProgressBar progress={today.completionPercent / 100} color={Colors.white} trackColor={Overlay.glass} />

        <View style={styles.statTiles}>
          <StatTile label="Studied today" value={`${today.todayMinutes}m`} />
          <StatTile label="Daily goal" value={`${today.dailyGoalMinutes}m`} />
          <StatTile label="Cards due" value={String(today.dueFlashcards)} />
          <StatTile label="Focus left" value={`${focusLeft}m`} />
        </View>

        {!!primaryItem && (
          <Pressable style={styles.ctaCard} onPress={() => router.push(routeForItem(primaryItem) as never)}>
            <View style={styles.ctaBody}>
              <Text style={styles.ctaTitle} numberOfLines={1}>{primaryItem.title}</Text>
              {!!primaryItem.subtitle && <Text style={styles.ctaSubtitle} numberOfLines={2}>{primaryItem.subtitle}</Text>}
              <Text style={styles.ctaAction}>Start session</Text>
            </View>
            <View style={styles.ctaArrow}>
              <ArrowRight size={16} color={Colors.primary} />
            </View>
          </Pressable>
        )}
      </LinearGradient>

      <Pressable style={({ pressed }) => [styles.summarizeCta, pressed && styles.pressed]} onPress={() => router.push('/summarizer')}>
        <IconBadge icon={Sparkles} size={40} gradient />
        <View style={styles.summarizeBody}>
          <Text style={styles.summarizeCtaTitle}>Turn anything into study material</Text>
          <Text style={styles.summarizeCtaSubtitle}>Summarize documents, videos, articles, audio, or text</Text>
        </View>
        <ArrowRight size={16} color={Colors.primary} />
      </Pressable>

      <SectionLabel label="Content Library" />
      <View style={styles.grid}>
        <CountTile icon={FileText} color={Colors.blue} label="Documents" value={stats.totalDocuments} onPress={() => router.push({ pathname: '/library', params: { type: 'documents' } })} />
        <CountTile icon={Video} color={Colors.red} label="Videos" value={stats.totalVideos} onPress={() => router.push({ pathname: '/library', params: { type: 'videos' } })} />
        <CountTile icon={Globe} color={Colors.teal} label="Articles" value={stats.totalArticles} onPress={() => router.push({ pathname: '/library', params: { type: 'articles' } })} />
        <CountTile icon={Mic} color={Colors.amber} label="Audio" value={stats.totalAudio} onPress={() => router.push({ pathname: '/library', params: { type: 'audio' } })} />
      </View>

      <SectionLabel label="Study Tools" />
      <View style={styles.grid}>
        <CountTile icon={Layers} color={Colors.yellow} label="Flashcards" value={stats.totalFlashcards} onPress={() => router.push('/study/flashcards')} />
        <CountTile icon={Target} color={Colors.emerald} label="Quizzes" value={stats.totalQuizQuestions} onPress={() => router.push('/study/quizzes')} />
        <CountTile icon={BookOpen} color={Colors.orange} label="Notes" value={stats.totalNotes} onPress={() => router.push('/study/notes')} />
        <CountTile icon={BookOpen} color={Colors.teal} label="Glossary" value={stats.totalGlossaryTerms} onPress={() => router.push('/study/glossary')} />
      </View>

      <SectionLabel label="Reinforcement" />
      <View style={styles.reinforceRow}>
        <ReinforceCard label="Quiz mistakes" value={summary.reinforcement.quizMistakes} color={Colors.red} onPress={() => router.push('/study/quizzes')} />
        <ReinforceCard label="Unmastered terms" value={summary.reinforcement.unmasteredTerms} color={Colors.amber} onPress={() => router.push('/study/glossary')} />
        <ReinforceCard label="Hard flashcards" value={summary.reinforcement.hardFlashcards} color={Colors.purple} onPress={() => router.push('/study/flashcards')} />
      </View>

      <Card style={styles.xpCard}>
        <View style={styles.xpHeader}>
          <IconBadge icon={Zap} color={Colors.amber} size={32} />
          <Text style={styles.xpTitle}>Level {xp.level}</Text>
          <Text style={styles.xpSubtitle}>{xp.totalXp} XP</Text>
        </View>
        <ProgressBar progress={xp.levelProgress / 100} gradient={Gradients.amber} />
        <Text style={styles.xpFooter}>{xp.xpIntoLevel} / {xp.xpForNextLevel} XP to next level</Text>
      </Card>

      <Card style={styles.digestCard}>
        <View style={styles.xpHeader}>
          <IconBadge icon={TrendingUp} size={32} />
          <Text style={styles.xpTitle}>Your week</Text>
        </View>
        <Text style={styles.digestHeadline}>{digest.headline}</Text>
        <View style={styles.digestStats}>
          <DigestStat label="Study time" value={`${digest.studyMinutes}m`} />
          <DigestStat label="Flashcard reviews" value={String(digest.flashcardReviews)} />
          <DigestStat label="Quizzes taken" value={`${digest.quizzesTaken} (${Math.round(digest.quizAccuracy)}%)`} />
          <DigestStat label="Open mistakes" value={String(digest.openMistakes)} />
        </View>
      </Card>

      <SectionLabel label="Study Calendar" />
      <StudyCalendar />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  eyebrow: { ...Typography.captionBold, color: Colors.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: -Spacing.two },
  greeting: { ...Typography.title, color: Colors.textPrimary },
  pressed: { opacity: 0.85 },

  heroCard: { gap: Spacing.three, borderRadius: Radius.xl, padding: Spacing.three, ...Shadows.primaryGlow },
  heroHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { ...Typography.caption, color: Overlay.onGradientMuted },
  heroPercent: { ...Typography.title, fontSize: 34, color: Colors.white },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Overlay.glass,
    borderWidth: 1, borderColor: Overlay.glassBorder,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill,
  },
  streakText: { ...Typography.captionBold, color: Colors.white },
  streakBest: { ...Typography.caption, color: Overlay.onGradientMuted, fontSize: 10 },

  statTiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },

  ctaCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    backgroundColor: Overlay.glassStrong, borderWidth: 1, borderColor: Overlay.glassBorder,
    borderRadius: Radius.lg, padding: Spacing.three,
  },
  ctaBody: { flex: 1 },
  ctaTitle: { ...Typography.bodyBold, color: Colors.white },
  ctaSubtitle: { ...Typography.caption, color: Overlay.onGradientMuted, marginTop: 2 },
  ctaAction: { ...Typography.captionBold, color: Colors.white, marginTop: Spacing.two },
  ctaArrow: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },

  summarizeCta: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, padding: Spacing.three,
    ...Shadows.card,
  },
  summarizeBody: { flex: 1 },
  summarizeCtaTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  summarizeCtaSubtitle: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },

  reinforceRow: { flexDirection: 'row', gap: Spacing.two },

  // Opaque amber-tinted surface (not an alpha wash) — Card carries elevation,
  // and Android elevation shadows render wrong behind translucent backgrounds.
  xpCard: { gap: Spacing.two, backgroundColor: '#fef6e7' },
  xpHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  xpTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  xpSubtitle: { ...Typography.caption, color: Colors.textSecondary, marginLeft: 'auto' },
  xpFooter: { ...Typography.caption, color: Colors.textSecondary },

  digestCard: { gap: Spacing.two },
  digestHeadline: { ...Typography.body, color: Colors.textPrimary },
  digestStats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
