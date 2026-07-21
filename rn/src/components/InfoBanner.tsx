import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type LucideIcon } from 'lucide-react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

interface InfoBannerProps {
  icon: LucideIcon;
  text: string;
}

export const InfoBanner: React.FC<InfoBannerProps> = ({ icon: Icon, text }) => (
  <View style={styles.root}>
    <Icon size={14} color={Colors.primary} />
    <Text style={styles.text}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: Spacing.two,
    borderRadius: Radius.md,
    backgroundColor: Colors.zinc200,
    borderWidth: 1,
    borderColor: Colors.zinc300,
  },
  text: { flex: 1, fontSize: 10, lineHeight: 14, color: Colors.textSecondary },
});
