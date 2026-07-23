import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Bot from 'lucide-react-native/icons/bot';
import FileText from 'lucide-react-native/icons/file-text';
import MessageSquarePlus from 'lucide-react-native/icons/message-square-plus';
import Trash2 from 'lucide-react-native/icons/trash-2';
import Video from 'lucide-react-native/icons/video';

import { EmptyState } from '@/components/EmptyState';
import { IconBadge } from '@/components/IconBadge';
import { PressableScale } from '@/components/PressableScale';
import { Colors, Gradients, Layout, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { chatService, ChatSessionSummary } from '@/services/chatService';

function formatTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function ChatListScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const all = await chatService.getSessions();
      setSessions(
        all
          .filter((s) => s.messageCount > 0)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleNew = async () => {
    setCreating(true);
    try {
      const conversation = await chatService.createConversation();
      router.push(`/(tabs)/chat/${conversation.conversationId}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (item: ChatSessionSummary) => {
    setDeletingId(item.conversationId);
    try {
      if (item.sourceType === 'general') {
        await chatService.deleteConversation(item.conversationId);
      } else {
        await chatService.deleteThread(item.sourceType, item.sourceId, item.courseId ?? undefined, item.conversationId);
      }
      setSessions((prev) => prev.filter((s) => s.conversationId !== item.conversationId));
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpen = (item: ChatSessionSummary) => {
    if (item.sourceType === 'general') {
      router.push(`/(tabs)/chat/${item.conversationId}`);
    } else {
      router.push({
        pathname: '/library/scoped-chat',
        params: {
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          courseId: item.courseId ?? undefined,
          title: item.sourceName,
        },
      });
    }
  };

  return (
    <View style={styles.root}>
      <PressableScale
        style={styles.newButton}
        onPress={handleNew}
        disabled={creating}
      >
        <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.newButtonInner}>
          {creating ? (
            <ActivityIndicator color={Colors.primaryForeground} />
          ) : (
            <>
              <MessageSquarePlus size={18} color={Colors.primaryForeground} />
              <Text style={styles.newButtonText}>New conversation</Text>
            </>
          )}
        </LinearGradient>
      </PressableScale>

      {loading ? (
        <ActivityIndicator style={styles.loading} color={Colors.primary} />
      ) : sessions.length === 0 ? (
        <EmptyState icon={Bot} title="No conversations yet" subtitle="Start a new chat to ask the AI anything." />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => s.conversationId}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <PressableScale
              style={styles.card}
              onPress={() => handleOpen(item)}
            >
              {item.sourceType === 'document' ? (
                <IconBadge icon={FileText} color={Colors.blue} size={40} iconSize={18} />
              ) : item.sourceType === 'video' ? (
                <IconBadge icon={Video} color={Colors.red} size={40} iconSize={18} />
              ) : (
                <IconBadge icon={Bot} size={40} iconSize={18} />
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.conversationTitle || item.sourceName}</Text>
                {!!item.lastMessage && <Text style={styles.cardSubtitle} numberOfLines={1}>{item.lastMessage}</Text>}
              </View>
              <Text style={styles.cardTime}>{formatTime(item.updatedAt)}</Text>
              <Pressable
                hitSlop={8}
                style={styles.deleteButton}
                onPress={() => handleDelete(item)}
                disabled={deletingId === item.conversationId}
              >
                {deletingId === item.conversationId ? (
                  <ActivityIndicator size="small" color={Colors.textSecondary} />
                ) : (
                  <Trash2 size={16} color={Colors.textSecondary} />
                )}
              </Pressable>
            </PressableScale>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  newButton: { margin: Spacing.three, borderRadius: Radius.pill, ...Shadows.primaryGlow },
  newButtonInner: {
    ...Layout.row, justifyContent: 'center', gap: Spacing.two,
    height: 48, borderRadius: Radius.pill,
  },
  newButtonText: { ...Typography.bodyBold, color: Colors.primaryForeground },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two },
  card: {
    ...Layout.row, gap: Spacing.two,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.three,
    ...Shadows.card,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  cardSubtitle: { ...Typography.caption, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cardTime: { ...Typography.caption, fontSize: 11, color: Colors.textSecondary, marginLeft: Spacing.one },
  deleteButton: { padding: Spacing.one },
  loading: { marginTop: Spacing.five },
});
