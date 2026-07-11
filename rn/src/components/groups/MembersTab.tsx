import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Crown, User as UserIcon, X } from 'lucide-react-native';

import { Card } from '@/components/Card';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import type { GroupMember } from '@/services/studyGroupService';

interface MembersTabProps {
  members: GroupMember[];
  currentUserId?: string;
  isOwner?: boolean;
  onRemove?: (userId: string) => Promise<void>;
}

export const MembersTab: React.FC<MembersTabProps> = ({ members, currentUserId, isOwner, onRemove }) => {
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const confirmRemove = (userId: string, userName: string) => {
    Alert.alert('Remove member', `Remove "${userName}" from this group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemovingUserId(userId);
          try {
            await onRemove?.(userId);
          } finally {
            setRemovingUserId(null);
          }
        },
      },
    ]);
  };

  return (
    <FlatList
      data={members}
      keyExtractor={(m) => m.userId}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Card style={styles.row}>
          <View style={styles.icon}>
            {item.role === 'owner' ? <Crown size={16} color={Colors.amber} /> : <UserIcon size={16} color={Colors.textSecondary} />}
          </View>
          <Text style={styles.name}>{item.userName}</Text>
          <Text style={styles.role}>{item.role}</Text>
          {isOwner && item.userId !== currentUserId && (
            <Pressable onPress={() => confirmRemove(item.userId, item.userName)} disabled={removingUserId === item.userId} hitSlop={8}>
              {removingUserId === item.userId ? (
                <ActivityIndicator size="small" color={Colors.textSecondary} />
              ) : (
                <X size={15} color={Colors.textSecondary} />
              )}
            </Pressable>
          )}
        </Card>
      )}
    />
  );
};

const styles = StyleSheet.create({
  list: { padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  icon: { width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: Colors.bgApp, alignItems: 'center', justifyContent: 'center' },
  name: { ...Typography.bodyBold, color: Colors.textPrimary, flex: 1 },
  role: { ...Typography.captionBold, color: Colors.textSecondary, textTransform: 'uppercase' },
});
