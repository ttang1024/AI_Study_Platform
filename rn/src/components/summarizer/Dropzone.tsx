import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

interface DropzoneProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
}

// Shared file-picker trigger used by DocumentForm and the upload/lecture
// sub-tabs of VideoForm and AudioForm.
export const Dropzone: React.FC<DropzoneProps> = ({ icon: Icon, title, subtitle, onPress }) => (
  <Pressable style={styles.dropzone} onPress={onPress}>
    <Icon size={28} color={Colors.primary} />
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.subtitle}>{subtitle}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  dropzone: {
    alignItems: 'center', justifyContent: 'center', gap: Spacing.one,
    borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.border, borderRadius: Radius.lg,
    paddingVertical: Spacing.five, paddingHorizontal: Spacing.three, backgroundColor: Colors.bgSidebar,
  },
  title: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
});
