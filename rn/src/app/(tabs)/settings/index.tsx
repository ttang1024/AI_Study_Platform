import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Activity from 'lucide-react-native/icons/activity';
import Bell from 'lucide-react-native/icons/bell';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import KeyRound from 'lucide-react-native/icons/key-round';
import MessageSquarePlus from 'lucide-react-native/icons/message-square-plus';
import UserCircle from 'lucide-react-native/icons/circle-user';
import Volume2 from 'lucide-react-native/icons/volume-2';
import CreditCard from 'lucide-react-native/icons/credit-card';
import Languages from 'lucide-react-native/icons/languages';

import { Button } from '@/components/Button';
import { IconBadge } from '@/components/IconBadge';
import { PasswordSection } from '@/components/settings/PasswordSection';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { SecuritySection } from '@/components/settings/SecuritySection';
import { Colors, Gradients, Layout, Overlay, Radius, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function SettingsScreen() {
  const { user, updateProfile, changePassword, logout } = useAuth();
  const router = useRouter();

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content]}>
      <LinearGradient colors={Gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <UserCircle size={28} color={Colors.white} />
        </View>
        <View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
      </LinearGradient>

      <ProfileSection
        name={user?.name ?? ''}
        email={user?.email}
        onSave={(name) => updateProfile({ fullName: name })}
      />

      <PasswordSection onSave={changePassword} />

      <SecuritySection />

      <View style={styles.section}>
        <Pressable style={styles.navRow} onPress={() => router.push('/settings/ai-services')}>
          <IconBadge icon={KeyRound} size={36} />
          <View style={styles.navBody}>
            <Text style={styles.navTitle}>AI Services</Text>
            <Text style={styles.navSubtitle}>Bring your own API key for Gemini, OpenAI, Claude, and more</Text>
          </View>
          <ChevronRight size={18} color={Colors.textSecondary} />
        </Pressable>
        {/* Directly under AI Services: the keys are configured there, this is what they cost. */}
        <Pressable style={styles.navRow} onPress={() => router.push('/settings/ai-usage')}>
          <IconBadge icon={Activity} size={36} />
          <View style={styles.navBody}>
            <Text style={styles.navTitle}>AI Usage</Text>
            <Text style={styles.navSubtitle}>What your AI calls have cost, by feature and model</Text>
          </View>
          <ChevronRight size={18} color={Colors.textSecondary} />
        </Pressable>
        {/* After usage: the limit shown there is set by the plan shown here. */}
        <Pressable style={styles.navRow} onPress={() => router.push('/settings/plan')}>
          <IconBadge icon={CreditCard} size={36} />
          <View style={styles.navBody}>
            <Text style={styles.navTitle}>Plan</Text>
            <Text style={styles.navSubtitle}>Your plan, today&apos;s AI usage, and what each tier includes</Text>
          </View>
          <ChevronRight size={18} color={Colors.textSecondary} />
        </Pressable>
        <Pressable style={styles.navRow} onPress={() => router.push('/settings/language')}>
          <IconBadge icon={Languages} size={36} />
          <View style={styles.navBody}>
            <Text style={styles.navTitle}>Language</Text>
            <Text style={styles.navSubtitle}>Interface language; your study material is not translated</Text>
          </View>
          <ChevronRight size={18} color={Colors.textSecondary} />
        </Pressable>
        <Pressable style={styles.navRow} onPress={() => router.push('/settings/voice')}>
          <IconBadge icon={Volume2} size={36} />
          <View style={styles.navBody}>
            <Text style={styles.navTitle}>Voice</Text>
            <Text style={styles.navSubtitle}>Pick the neural voice used to read notes, terms, and replies aloud</Text>
          </View>
          <ChevronRight size={18} color={Colors.textSecondary} />
        </Pressable>
        <Pressable style={styles.navRow} onPress={() => router.push('/settings/notifications')}>
          <IconBadge icon={Bell} size={36} />
          <View style={styles.navBody}>
            <Text style={styles.navTitle}>Notifications</Text>
            <Text style={styles.navSubtitle}>Daily study reminder and due-card push alerts</Text>
          </View>
          <ChevronRight size={18} color={Colors.textSecondary} />
        </Pressable>
        <Pressable style={styles.navRow} onPress={() => router.push('/settings/feedback')}>
          <IconBadge icon={MessageSquarePlus} size={36} />
          <View style={styles.navBody}>
            <Text style={styles.navTitle}>Feedback</Text>
            <Text style={styles.navSubtitle}>Report a bug, request a feature, or share your thoughts</Text>
          </View>
          <ChevronRight size={18} color={Colors.textSecondary} />
        </Pressable>
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
