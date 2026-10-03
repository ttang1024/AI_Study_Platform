import { StyleSheet, Text, View } from 'react-native';
import Calendar from 'lucide-react-native/icons/calendar';
import Share2 from 'lucide-react-native/icons/share-2';
import User from 'lucide-react-native/icons/user';

import { Alpha, Colors, Layout, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import type { SharedContent } from '@/services/shareService';
import { SOURCE_BADGES } from '@/hooks/useSharedContent';

interface Props {
  content: SharedContent;
  sourceType: string | null;
  createdAt: string;
}

export function SharedContentHeader({ content, sourceType, createdAt }: Props) {
  return (
    <View style={styles.headerCard}>
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Share2 size={11} color={Colors.primary} />
          <Text style={styles.badgeText}>{sourceType === 'chat' ? 'Shared Conversation' : 'Shared Study Content'}</Text>
        </View>
        {!!sourceType && !!SOURCE_BADGES[sourceType] && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{SOURCE_BADGES[sourceType]}</Text>
          </View>
        )}
      </View>
      <Text style={styles.title}>{content.title}</Text>
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <User size={12} color={Colors.textSecondary} />
          <Text style={styles.metaText}>{content.ownerName}</Text>
        </View>
        <View style={styles.metaItem}>
          <Calendar size={12} color={Colors.textSecondary} />
          <Text style={styles.metaText}>{createdAt}</Text>
        </View>
        {!!content.expiresAt && (
          <Text style={styles.expiryText}>Expires {new Date(content.expiresAt).toLocaleDateString()}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two, ...Shadows.card,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  badge: {
    ...Layout.row, gap: 5,
    backgroundColor: `${Colors.primary}${Alpha.tint}`, borderRadius: Radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeText: { ...Typography.captionBold, color: Colors.primary, fontSize: 11 },
  title: { ...Typography.screenTitle, color: Colors.textPrimary },
  metaRow: { ...Layout.rowWrap, gap: Spacing.three },
  metaItem: { ...Layout.row, gap: 4 },
  metaText: { ...Typography.caption, color: Colors.textSecondary },
  expiryText: { ...Typography.caption, color: Colors.amber },
});
