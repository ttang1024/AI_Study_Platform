import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Calendar from 'lucide-react-native/icons/calendar';
import CalendarClock from 'lucide-react-native/icons/calendar-clock';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import HelpCircle from 'lucide-react-native/icons/circle-question-mark';
import Layers from 'lucide-react-native/icons/layers';
import Network from 'lucide-react-native/icons/network';
import NotebookPen from 'lucide-react-native/icons/notebook-pen';
import PenLine from 'lucide-react-native/icons/pen-line';
import Share2 from 'lucide-react-native/icons/share-2';
import SquareLibrary from 'lucide-react-native/icons/square-library';
import TrendingUp from 'lucide-react-native/icons/trending-up';
import Trophy from 'lucide-react-native/icons/trophy';
import Users from 'lucide-react-native/icons/users';
import Zap from 'lucide-react-native/icons/zap';
import School from 'lucide-react-native/icons/school';
import FilePen from 'lucide-react-native/icons/file-pen';
import Languages from 'lucide-react-native/icons/languages';
import Terminal from 'lucide-react-native/icons/terminal';

import { IconBadge } from '@/components/IconBadge';
import { PressableScale } from '@/components/PressableScale';
import { Colors, Gradients, Layout, Overlay, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

// Practice is promoted to the hero card above; everything else lives in the grid.
const HUB_ITEMS = [
  { href: '/study/flashcards', icon: Layers, color: Colors.amber, title: 'Flashcards', subtitle: 'FSRS-scheduled review' },
  { href: '/study/quizzes', icon: HelpCircle, color: Colors.emerald, title: 'Quizzes', subtitle: 'Bank, history, mistakes' },
  { href: '/study/notes', icon: NotebookPen, color: Colors.orange, title: 'Notes', subtitle: 'Across your library' },
  { href: '/study/handwriting', icon: PenLine, color: Colors.red, title: 'Check Working', subtitle: 'Grade handwritten solutions' },
  { href: '/study/essays', icon: FilePen, color: Colors.purple, title: 'Writing', subtitle: 'Rubric feedback on drafts' },
  { href: '/study/code', icon: Terminal, color: Colors.blue, title: 'Code', subtitle: 'Run Python on device' },
  { href: '/study/language', icon: Languages, color: Colors.teal, title: 'Language', subtitle: 'Pronunciation and sentence mining' },
  { href: '/study/glossary', icon: SquareLibrary, color: Colors.teal, title: 'Glossary', subtitle: 'Terms and definitions' },
  { href: '/study/planner', icon: CalendarClock, color: Colors.blue, title: 'Planner', subtitle: 'Exams, cram sheets, mocks' },
  { href: '/study/calendar', icon: Calendar, color: Colors.red, title: 'Calendar', subtitle: 'Everything, by day' },
  { href: '/study/groups', icon: Users, color: Colors.purple, title: 'Study Groups', subtitle: 'Chat, boards, battles' },
  { href: '/study/classrooms', icon: School, color: Colors.purple, title: 'Classrooms', subtitle: 'Assigned courses and grades' },
  { href: '/study/insights', icon: TrendingUp, color: Colors.primary, title: 'Insights', subtitle: 'Time, accuracy, mastery' },
  { href: '/study/concepts', icon: Network, color: Colors.blue, title: 'Concepts', subtitle: 'Links, gaps, learning path' },
  { href: '/study/achievements', icon: Trophy, color: Colors.amber, title: 'Achievements', subtitle: 'Milestones unlocked' },
  { href: '/study/shared-link', icon: Share2, color: Colors.teal, title: 'Shared link', subtitle: 'Open content shared with you' },
] as const;

export default function StudyHubScreen() {
  const router = useRouter();
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <PressableScale onPress={() => router.push('/study/practice')}>
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
      </PressableScale>

      <View style={styles.grid}>
        {HUB_ITEMS.map((item) => (
          <PressableScale
            key={item.href}
            style={styles.tile}
            onPress={() => router.push(item.href)}
          >
            <IconBadge icon={item.icon} color={item.color} size={44} iconSize={20} />
            <Text style={styles.tileTitle}>{item.title}</Text>
            <Text style={styles.tileSubtitle} numberOfLines={2}>{item.subtitle}</Text>
          </PressableScale>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },

  hero: {
    ...Layout.row, gap: Spacing.three,
    borderRadius: Radius.xl, padding: Spacing.three, ...Shadows.primaryGlow,
  },
  heroIcon: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Overlay.glass, ...Layout.center },
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
