import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import FileArchive from 'lucide-react-native/icons/file-archive';

import { IconBadge } from '@/components/IconBadge';
import { PasswordSection } from '@/components/settings/PasswordSection';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { SecuritySection } from '@/components/settings/SecuritySection';
import { Colors, Layout, Radius, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function AccountSettingsScreen() {
  const { user, updateProfile, changePassword } = useAuth();
  const router = useRouter();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ProfileSection
        name={user?.name ?? ''}
        email={user?.email}
        onSave={(name) => updateProfile({ fullName: name })}
      />

      <PasswordSection onSave={changePassword} />

      <SecuritySection />

      <Pressable style={styles.navRow} onPress={() => router.push('/settings/data')}>
        <IconBadge icon={FileArchive} size={36} />
        <View style={styles.navBody}>
          <Text style={styles.navTitle}>Your data</Text>
          <Text style={styles.navSubtitle}>Download everything we hold, or delete your account</Text>
        </View>
        <ChevronRight size={18} color={Colors.textSecondary} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
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
