import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar, CalendarClock, ChevronRight, HelpCircle, Layers, Network, NotebookPen, Share2, SquareLibrary, Trophy, TrendingUp, Users, Zap } from 'lucide-react-native';

import { IconBadge } from '@/components/IconBadge';
import { Colors, Gradients, Overlay, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

// Practice is promoted to the hero card above; everything else lives in the grid.
const HUB_ITEMS = [
  { href: '/study/flashcards', icon: Layers, color: Colors.amber, title: 'Flashcards', subtitle: 'FSRS-scheduled review' },
  { href: '/study/quizzes', icon: HelpCircle, color: Colors.emerald, title: 'Quizzes', subtitle: 'Bank, history, mistakes' },
  { href: '/study/notes', icon: NotebookPen, color: Colors.orange, title: 'Notes', subtitle: 'Across your library' },
  { href: '/study/glossary', icon: SquareLibrary, color: Colors.teal, title: 'Glossary', subtitle: 'Terms and definitions' },
  { href: '/study/planner', icon: CalendarClock, color: Colors.blue, title: 'Planner', subtitle: 'Exams, cram sheets, mocks' },
  { href: '/study/calendar', icon: Calendar, color: Colors.red, title: 'Calendar', subtitle: 'Everything, by day' },
  { href: '/study/groups', icon: Users, color: Colors.purple, title: 'Study Groups', subtitle: 'Chat, boards, battles' },
  { href: '/study/insights', icon: TrendingUp, color: Colors.primary, title: 'Insights', subtitle: 'Time, accuracy, mastery' },
  { href: '/study/concepts', icon: Network, color: Colors.blue, title: 'Concepts', subtitle: 'Links, gaps, learning path' },
  { href: '/study/achievements', icon: Trophy, color: Colors.amber, title: 'Achievements', subtitle: 'Milestones unlocked' },
  { href: '/study/shared-link', icon: Share2, color: Colors.teal, title: 'Shared link', subtitle: 'Open content shared with you' },
] as const;

export default function StudyHubScreen() {
  const router = useRouter();
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.push('/study/practice')} style={({ pressed }) => pressed && styles.pressedDim}>
        <LinearGradient colors={Gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroIcon}>
            <Zap size={22} color={Colors.white} />
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.heroTitle}>Practice</Text>
            <Text style={styles.heroSubtitle}>Daily smart session and mixed timed tests</Text>
          </View>
          <ChevronRight size={20} color={Overlay.onGradientMuted} />
        </LinearGradient>
      </Pressable>

      <View style={styles.grid}>
        {HUB_ITEMS.map((item) => (
          <Pressable
            key={item.href}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            onPress={() => router.push(item.href)}
          >
            <IconBadge icon={item.icon} color={item.color} size={44} iconSize={20} />
            <Text style={styles.tileTitle}>{item.title}</Text>
            <Text style={styles.tileSubtitle} numberOfLines={2}>{item.subtitle}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },
  pressedDim: { opacity: 0.85 },

  hero: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.three,
    borderRadius: Radius.xl, padding: Spacing.three, ...Shadows.primaryGlow,
  },
  heroIcon: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Overlay.glass, alignItems: 'center', justifyContent: 'center' },
  heroBody: { flex: 1 },
  heroTitle: { ...Typography.subheading, color: Colors.white },
  heroSubtitle: { ...Typography.caption, color: Overlay.onGradientMuted, marginTop: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: {
    width: '48%', flexGrow: 1, gap: Spacing.two,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.three,
    ...Shadows.card,
  },
  tilePressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  tileTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  tileSubtitle: { ...Typography.caption, fontSize: 12, lineHeight: 16, color: Colors.textSecondary },
});
