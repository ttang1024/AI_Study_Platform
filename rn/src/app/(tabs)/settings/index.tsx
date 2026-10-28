import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Activity from 'lucide-react-native/icons/activity';
import Bell from 'lucide-react-native/icons/bell';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import KeyRound from 'lucide-react-native/icons/key-round';
import MessageSquarePlus from 'lucide-react-native/icons/message-square-plus';
import UserCircle from 'lucide-react-native/icons/circle-user';
import Gauge from 'lucide-react-native/icons/gauge';
import Volume2 from 'lucide-react-native/icons/volume-2';
import Languages from 'lucide-react-native/icons/languages';

import { Button } from '@/components/Button';
import { IconBadge } from '@/components/IconBadge';
import { PressableScale } from '@/components/PressableScale';
import { Colors, Gradients, Layout, Overlay, Radius, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

// AI Usage sits directly under AI Services: the keys are configured there, this is what they cost.
const NAV_ITEMS = [
  { href: '/settings/ai-services', icon: KeyRound, title: 'AI Services', subtitle: 'Bring your own API key for Gemini, OpenAI, Claude, and more' },
  { href: '/settings/ai-usage', icon: Activity, title: 'AI Usage', subtitle: 'What your AI calls have cost, by feature and model' },
  { href: '/settings/language', icon: Languages, title: 'Language', subtitle: 'Interface language; your study material is not translated' },
  { href: '/settings/scheduler', icon: Gauge, title: 'Scheduler', subtitle: 'Target retention, interval limits, and tuning FSRS to your own reviews' },
  { href: '/settings/voice', icon: Volume2, title: 'Voice', subtitle: 'Pick the neural voice used to read notes, terms, and replies aloud' },
  { href: '/settings/notifications', icon: Bell, title: 'Notifications', subtitle: 'Daily study reminder and due-card push alerts' },
  { href: '/settings/feedback', icon: MessageSquarePlus, title: 'Feedback', subtitle: 'Report a bug, request a feature, or share your thoughts' },
] as const;

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content]}>
      {/* The profile card opens Account: name, password, 2FA/sessions, and data export/deletion. */}
      <PressableScale onPress={() => router.push('/settings/account')}>
        <LinearGradient colors={Gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <UserCircle size={28} color={Colors.white} />
          </View>
          <View style={styles.navBody}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
          <ChevronRight size={20} color={Overlay.onGradientMuted} />
        </LinearGradient>
      </PressableScale>

      <View style={styles.section}>
        {NAV_ITEMS.map((item) => (
          <Pressable key={item.href} style={styles.navRow} onPress={() => router.push(item.href)}>
            <IconBadge icon={item.icon} size={36} />
            <View style={styles.navBody}>
              <Text style={styles.navTitle}>{item.title}</Text>
              <Text style={styles.navSubtitle}>{item.subtitle}</Text>
            </View>
            <ChevronRight size={18} color={Colors.textSecondary} />
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <Button title="Log Out" variant="secondary" onPress={logout} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  profileCard: {
    ...Layout.row, gap: Spacing.three,
    borderRadius: Radius.xl, padding: Spacing.four,
    ...Shadows.primaryGlow,
  },
  avatarCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Overlay.glass, borderWidth: 1, borderColor: Overlay.glassBorder,
    ...Layout.center,
  },
  name: { fontSize: 16, fontWeight: '800', color: Colors.white },
  email: { fontSize: 13, color: Overlay.onGradientMuted, marginTop: 2 },
  section: { gap: Spacing.two },

  navRow: {
    ...Layout.row, gap: Spacing.three,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, padding: Spacing.three,
    ...Shadows.card,
  },
  navBody: { flex: 1 },
  navTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  navSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
