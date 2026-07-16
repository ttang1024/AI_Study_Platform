import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChatBubble } from '@/components/chat/ChatBubble';
import { Composer } from '@/components/chat/Composer';
import { Alpha, Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import type { ConnectionState, GroupChatMessage } from '@/services/groupChatSocket';
import { useAuth } from '@/context/AuthContext';

const STATE_LABEL: Record<ConnectionState, string> = {
  connecting: 'Connecting…',
  connected: 'Live',
  reconnecting: 'Reconnecting…',
  disconnected: 'Disconnected',
};

// Presentational: the group detail screen owns the hub connection (it also feeds
// the live study room) and passes messages/state down.
interface GroupChatViewProps {
  messages: GroupChatMessage[];
  loading: boolean;
  connectionState: ConnectionState;
  onSend: (content: string) => Promise<void>;
}

export const GroupChatView: React.FC<GroupChatViewProps> = ({ messages, loading, connectionState, onSend }) => {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || connectionState !== 'connected') return;
    setInput('');
    try {
      await onSend(text);
    } catch {
      // The socket will surface a disconnected state on failure; nothing else to do client-side.
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={140}>
      <View style={styles.statusRow}>
        <View style={[styles.statusPill, connectionState === 'connected' && styles.statusPillLive]}>
          <View style={[styles.statusDot, connectionState === 'connected' && styles.statusDotLive]} />
          <Text style={[styles.statusText, connectionState === 'connected' && styles.statusTextLive]}>
            {STATE_LABEL[connectionState]}
          </Text>
        </View>
      </View>

      {!loading && (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m) => {
            const isMe = m.userId === user?.id;
            return (
              <ChatBubble key={m.groupChatMessageId} self={isMe}>
                {!isMe && <Text style={styles.senderName}>{m.userName}</Text>}
                <Text style={isMe ? styles.textMe : styles.textOther}>{m.content}</Text>
              </ChatBubble>
            );
          })}
        </ScrollView>
      )}

      <Composer
        input={input}
        onChangeInput={setInput}
        onSend={handleSend}
        disabled={!input.trim() || connectionState !== 'connected'}
        placeholder="Message the group…"
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  statusRow: { alignItems: 'center', paddingTop: Spacing.two },
  statusPill: {
    ...Layout.row,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusPillLive: { backgroundColor: `${Colors.primary}${Alpha.wash}`, borderColor: `${Colors.primary}${Alpha.strong}` },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.textSecondary },
  statusDotLive: { backgroundColor: Colors.emerald },
  statusText: { ...Typography.captionBold, color: Colors.textSecondary },
  statusTextLive: { color: Colors.primaryDeep },
  list: { padding: Spacing.three, gap: Spacing.two },
  senderName: { ...Typography.captionBold, color: Colors.primary, marginBottom: 2 },
  textMe: { color: Colors.primaryForeground, fontSize: 14, lineHeight: 21 },
  textOther: { color: Colors.textPrimary, fontSize: 14, lineHeight: 21 },
});
