import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { SummaryMarkdown } from '@/components/SummaryMarkdown';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { Colors, Spacing } from '@/constants/theme';
import { DEFAULT_DICTATION_LANGUAGE } from '@/constants/dictationLanguages';
import { AttachmentLightboxModal } from '@/components/chat/AttachmentLightboxModal';
import { Composer } from '@/components/chat/Composer';
import { LanguageMenuModal } from '@/components/chat/LanguageMenuModal';
import { MessageBubble, type ChatMessage } from '@/components/chat/MessageBubble';
import { StagingAttachmentsRow } from '@/components/chat/StagingAttachmentsRow';
import type { ChatAttachment, ChatMessageAttachment, ChatMessageDto } from '@/services/chatService';
import { STREAM_ERROR_MESSAGE } from '@/services/sse';
import { useSpeakReplies } from '@/hooks/useSpeakReplies';
import { MAX_ATTACHMENTS, useChatAttachments } from '@/hooks/useChatAttachments';
import { useDictation } from '@/hooks/useDictation';
import { markdownToPlainText } from '@/utils/markdownToPlainText';

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Shared by general chat (rn/src/app/(tabs)/chat/[id].tsx) and document/video-scoped chat
// (rn/src/app/(tabs)/library/scoped-chat.tsx) — only how messages are fetched/sent differs.
// `getMessages`/`sendMessage` are read once on mount (not re-run if their identity changes) —
// callers switching threads must remount via a `key` prop, not rely on prop-change refetching.
interface ChatThreadViewProps {
  getMessages: () => Promise<ChatMessageDto[]>;
  sendMessage: (text: string, onChunk: (chunk: string) => void, attachments?: ChatAttachment[]) => Promise<void>;
}

export const ChatThreadView: React.FC<ChatThreadViewProps> = ({ getMessages, sendMessage }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState<ChatMessageAttachment | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dictationLang, setDictationLang] = useState(DEFAULT_DICTATION_LANGUAGE.code);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { speakingId, speak } = useSpeakReplies();
  const { attachments, pickImages, pickCamera, pickDocument, removeAttachment, clearAttachments, toChatAttachments } = useChatAttachments();
  const { listening, toggle: toggleDictation, supported: dictationSupported } = useDictation((text) => setInput(text), dictationLang);

  useEffect(() => {
    getMessages().then((history) => {
      setMessages(history.map((m) => ({
        id: m.messageId,
        role: m.role === 'user' ? 'user' : 'model',
        content: m.content,
        attachments: m.attachments ?? undefined,
      })));
      setLoading(false);
    }).catch(() => setLoading(false));
    // Intentionally run once on mount — see the `key`-to-remount note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
  }, []);

  const openAttachMenu = () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('Attachment limit reached', `You can attach up to ${MAX_ATTACHMENTS} files per message.`);
      return;
    }
    Alert.alert('Add attachment', undefined, [
      { text: 'Take Photo', onPress: () => void pickCamera() },
      { text: 'Choose Photo', onPress: () => void pickImages() },
      { text: 'Choose PDF', onPress: () => void pickDocument() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || sending) return;
    if (listening) toggleDictation();

    const outgoingAttachments = toChatAttachments();
    const displayAttachments: ChatMessageAttachment[] = attachments.map((a) => ({
      url: a.previewUri ?? '',
      mimeType: a.mimeType,
      fileName: a.fileName,
    }));

    setInput('');
    clearAttachments();
    setMessages((prev) => [...prev, { id: createId(), role: 'user', content: text, attachments: displayAttachments }]);
    setSending(true);
    setStreamingContent('');

    let accumulated = '';
    try {
      await sendMessage(text, (chunk) => {
        accumulated += chunk;
        setStreamingContent(accumulated);
      }, outgoingAttachments.length ? outgoingAttachments : undefined);
      setMessages((prev) => [...prev, { id: createId(), role: 'model', content: accumulated }]);
    } catch {
      setMessages((prev) => [...prev, { id: createId(), role: 'model', content: STREAM_ERROR_MESSAGE, isError: true }]);
    } finally {
      setStreamingContent('');
      setSending(false);
    }
  };

  const handleCopy = useCallback(async (id: string, content: string) => {
    await Clipboard.setStringAsync(markdownToPlainText(content));
    setCopiedId(id);
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    copiedTimeoutRef.current = setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
  }, []);

  const handleShare = useCallback((content: string) => {
    Share.share({ message: markdownToPlainText(content) }).catch(() => {});
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {loading ? (
        <ActivityIndicator style={styles.loading} color={Colors.primary} />
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              speakingId={speakingId}
              copiedId={copiedId}
              onSpeak={speak}
              onCopy={handleCopy}
              onShare={handleShare}
              onPreviewAttachment={setPreviewAttachment}
            />
          ))}
          {sending && (
            <ChatBubble>
              {streamingContent ? <SummaryMarkdown value={streamingContent} /> : <ActivityIndicator size="small" color={Colors.primary} />}
            </ChatBubble>
          )}
        </ScrollView>
      )}

      {attachments.length > 0 && <StagingAttachmentsRow attachments={attachments} onRemove={removeAttachment} />}

      <Composer
        input={input}
        onChangeInput={setInput}
        onSend={handleSend}
        disabled={(!input.trim() && attachments.length === 0) || sending}
        busy={sending}
        onOpenAttachMenu={openAttachMenu}
        dictation={{
          supported: dictationSupported,
          listening,
          onToggle: toggleDictation,
          onOpenLanguageMenu: () => setLanguageMenuOpen(true),
        }}
      />

      <LanguageMenuModal
        visible={languageMenuOpen}
        selectedCode={dictationLang}
        onSelect={(code) => { setDictationLang(code); setLanguageMenuOpen(false); }}
        onClose={() => setLanguageMenuOpen(false)}
      />

      <AttachmentLightboxModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  loading: { marginTop: Spacing.five },
  list: { padding: Spacing.three, gap: Spacing.two },
});
