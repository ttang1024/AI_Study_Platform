import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type LucideIcon } from 'lucide-react-native';

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
    {/* The card centers its contents, which sizes a bare child to its own width —
        a long single-line URL would then stretch the input past the screen. This
        stretch wrapper pins the field to the card width so the text scrolls inside it. */}
    <View style={styles.childWrap}>{children}</View>
  </Card>
);

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: Spacing.one, padding: Spacing.four, backgroundColor: Colors.bgSidebar },
  childWrap: { alignSelf: 'stretch' },
  title: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.two },
});
