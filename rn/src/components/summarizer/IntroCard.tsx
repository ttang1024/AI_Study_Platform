import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { Colors, Spacing } from '@/constants/theme';

interface IntroCardProps {
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

// Shared "icon + title + subtitle + input" intro card used by WebArticleForm,
// and the link/podcast sub-tabs of VideoForm and AudioForm.
export const IntroCard: React.FC<IntroCardProps> = ({ icon: Icon, iconColor = Colors.primary, title, subtitle, children }) => (
  <Card style={styles.card}>
    <Icon size={28} color={iconColor} />
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.subtitle}>{subtitle}</Text>
    {children}
  </Card>
);

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: Spacing.one, padding: Spacing.four, backgroundColor: Colors.bgSidebar },
  title: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.two },
});
