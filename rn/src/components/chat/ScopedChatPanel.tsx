import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Bot, MessageSquarePlus, Trash2 } from 'lucide-react-native';

import { ChatThreadView } from '@/components/chat/ChatThreadView';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { chatService, ChatScopeType, ChatThreadSummary } from '@/services/chatService';

interface ScopedChatPanelProps {
  sourceType: ChatScopeType;
  sourceId: string;
  courseId?: string;
  title?: string;
}

// Thread-list / thread-detail chat UI for a single document or video, embeddable inline
// (e.g. as a tab panel) as well as from the standalone `/library/scoped-chat` route.
export const ScopedChatPanel: React.FC<ScopedChatPanelProps> = ({ sourceType, sourceId, courseId, title }) => {
  const [threads, setThreads] = useState<ChatThreadSummary[] | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    chatService.listThreads(sourceType, sourceId, courseId).then(setThreads);
  }, [sourceType, sourceId, courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleNew = async () => {
    setCreating(true);
    try {
      const thread = await chatService.createThread(sourceType, sourceId, courseId);
      setThreads((prev) => (prev ? [thread, ...prev] : [thread]));
      setActiveThreadId(thread.conversationId);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (conversationId: string) => {
    setDeletingId(conversationId);
    try {
      await chatService.deleteThread(sourceType, sourceId, courseId, conversationId);
      setThreads((prev) => prev?.filter((t) => t.conversationId !== conversationId) ?? null);
    } finally {
      setDeletingId(null);
    }
  };

  if (activeThreadId) {
    return (
      <View style={styles.root}>
        <Pressable style={styles.backRow} onPress={() => setActiveThreadId(null)}>
          <ArrowLeft size={16} color={Colors.primary} />
          <Text style={styles.backText}>All threads</Text>
        </Pressable>
        <ChatThreadView
          key={activeThreadId}
          getMessages={() => chatService.getThreadMessages(sourceType, sourceId, courseId, activeThreadId)}
          sendMessage={(text, onChunk, attachments) => chatService.streamThreadMessage(sourceType, sourceId, courseId, activeThreadId, text, onChunk, undefined, attachments)}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Pressable style={styles.newButton} onPress={handleNew} disabled={creating}>
        {creating ? (
          <ActivityIndicator color={Colors.primaryForeground} />
        ) : (
          <>
            <MessageSquarePlus size={18} color={Colors.primaryForeground} />
            <Text style={styles.newButtonText}>New chat</Text>
          </>
        )}
      </Pressable>

      {threads === null ? (
        <ActivityIndicator style={{ marginTop: Spacing.five }} color={Colors.primary} />
      ) : threads.length === 0 ? (
        <View style={styles.empty}>
          <Bot size={32} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>No chats yet</Text>
          <Text style={styles.emptySubtitle}>Start a chat to ask questions about {title ?? 'this content'}.</Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.conversationId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => setActiveThreadId(item.conversationId)}>
              <View style={styles.cardIcon}>
                <Bot size={18} color={Colors.primary} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                {!!item.lastMessage && <Text style={styles.cardSubtitle} numberOfLines={1}>{item.lastMessage}</Text>}
              </View>
              <Pressable
                hitSlop={8}
                style={styles.deleteButton}
                onPress={() => handleDelete(item.conversationId)}
                disabled={deletingId === item.conversationId}
              >
                {deletingId === item.conversationId ? (
                  <ActivityIndicator size="small" color={Colors.textSecondary} />
                ) : (
                  <Trash2 size={16} color={Colors.textSecondary} />
                )}
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: Spacing.three, paddingBottom: Spacing.two },
  backText: { ...Typography.captionBold, color: Colors.primary },
  newButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two,
    margin: Spacing.three, height: 48, borderRadius: Radius.md, backgroundColor: Colors.primary,
  },
  newButtonText: { color: Colors.primaryForeground, fontSize: 15, fontWeight: '700' },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.two },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    backgroundColor: Colors.bgSidebar, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.three,
  },
  cardIcon: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: `${Colors.primary}1a`, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  deleteButton: { padding: Spacing.one },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingHorizontal: Spacing.five },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  emptySubtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
});
