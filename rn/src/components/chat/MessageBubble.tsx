import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Check, Copy, FileText, Share2, Square, Volume2 } from 'lucide-react-native';

import { SummaryMarkdown } from '@/components/SummaryMarkdown';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { Alpha, Colors, Layout, Overlay, Radius, Spacing, Typography } from '@/constants/theme';
import type { ChatMessageAttachment } from '@/services/chatService';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  isError?: boolean;
  attachments?: ChatMessageAttachment[];
}

interface MessageBubbleProps {
  message: ChatMessage;
  speakingId: string | null;
  copiedId: string | null;
  onSpeak: (id: string, content: string) => void;
  onCopy: (id: string, content: string) => void;
  onShare: (content: string) => void;
  onPreviewAttachment: (attachment: ChatMessageAttachment) => void;
}

// Memoized since it's rendered in a list where unrelated state (composer text,
// dictation) changes on every keystroke — re-rendering every bubble on each
// keystroke was the main perf cost in the unsplit ChatThreadView.
export const MessageBubble: React.FC<MessageBubbleProps> = React.memo(function MessageBubble({
  message: m,
  speakingId,
  copiedId,
  onSpeak,
  onCopy,
  onShare,
  onPreviewAttachment,
}) {
  return (
    <ChatBubble self={m.role === 'user'} style={m.isError && styles.bubbleError}>
      {!!m.attachments?.length && (
        <View style={styles.attachmentRow}>
          {m.attachments.map((att, i) => (
            <Pressable key={i} onPress={() => onPreviewAttachment(att)}>
              {att.mimeType.startsWith('image/') ? (
                <Image source={{ uri: att.url }} style={styles.attachmentThumb} contentFit="cover" cachePolicy="disk" transition={150} />
              ) : (
                <View style={[styles.attachmentChip, m.role === 'user' && styles.attachmentChipUser]}>
                  <FileText size={14} color={m.role === 'user' ? Colors.primaryForeground : Colors.primary} />
                  <Text
                    style={[styles.attachmentChipText, m.role === 'user' && styles.attachmentChipTextUser]}
                    numberOfLines={1}
                  >
                    {att.fileName ?? 'file.pdf'}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}
      {m.role === 'user' ? (
        !!m.content && <Text style={styles.userText}>{m.content}</Text>
      ) : (
        <>
          <SummaryMarkdown value={m.content} />
          {!m.isError && (
            <View style={styles.actionsRow}>
              <Pressable style={styles.actionButton} onPress={() => onSpeak(m.id, m.content)} hitSlop={8}>
                {speakingId === m.id ? (
                  <Square size={13} color={Colors.primary} fill={Colors.primary} />
                ) : (
                  <Volume2 size={14} color={Colors.textSecondary} />
                )}
                <Text style={[styles.speakText, speakingId === m.id && styles.speakTextActive]}>
                  {speakingId === m.id ? 'Stop' : 'Listen'}
                </Text>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={() => onCopy(m.id, m.content)} hitSlop={8}>
                {copiedId === m.id ? (
                  <Check size={13} color={Colors.primary} />
                ) : (
                  <Copy size={14} color={Colors.textSecondary} />
                )}
                <Text style={[styles.speakText, copiedId === m.id && styles.speakTextActive]}>
                  {copiedId === m.id ? 'Copied' : 'Copy'}
                </Text>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={() => onShare(m.content)} hitSlop={8}>
                <Share2 size={14} color={Colors.textSecondary} />
                <Text style={styles.speakText}>Share</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </ChatBubble>
  );
});

const styles = StyleSheet.create({
  bubbleError: { borderColor: Colors.red, borderWidth: 1 },
  userText: { ...Typography.body, color: Colors.primaryForeground },
  actionsRow: { ...Layout.row, gap: Spacing.three, marginTop: Spacing.two },
  actionButton: { ...Layout.row, gap: 4 },
  speakText: { ...Typography.caption, fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  speakTextActive: { color: Colors.primary },

  attachmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.two },
  attachmentThumb: { width: 96, height: 96, borderRadius: Radius.md, backgroundColor: Colors.zinc200 },
  attachmentChip: {
    ...Layout.row, gap: 6, maxWidth: 160,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radius.pill,
    backgroundColor: `${Colors.primary}${Alpha.tint}`,
  },
  attachmentChipUser: { backgroundColor: Overlay.glassStrong },
  attachmentChipText: { ...Typography.captionBold, fontSize: 12, color: Colors.textPrimary, flexShrink: 1 },
  attachmentChipTextUser: { color: Colors.primaryForeground },
});
