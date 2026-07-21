import { useCallback, useEffect, useRef, useState } from 'react';
import { attachmentsToDisplay, type ChatAttachment } from '../../services/aiService';
import { videoService, type VideoChatConversation } from '../../services/videoService';
import { ChatPanelRef } from '../../components/ai/ChatPanel';
import { getApiErrorCode } from '../../utils/apiError';
import type { ChatMsg, VideoStudyTab } from './types';

interface UseVideoChatArgs {
  id: string | undefined;
  /** Auto-scrolls the panel to the latest message when the chat tab becomes active. */
  activeTab: VideoStudyTab;
}

/** Multi-conversation (threaded) chat for the video detail page. */
export function useVideoChat({ id, activeTab }: UseVideoChatArgs) {
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatConversations, setChatConversations] = useState<VideoChatConversation[]>([]);
  // null = a fresh thread not yet persisted (created on first send)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const chatPanelRef = useRef<ChatPanelRef>(null);

  useEffect(() => {
    if (activeTab === 'chat') {
      requestAnimationFrame(() => chatPanelRef.current?.scrollToBottom());
    }
  }, [activeTab]);

  /** Hydrate from the initial page-load fetch (most recent thread opens by default). */
  const applyLoadedConversations = useCallback((conversations: VideoChatConversation[], messages: ChatMsg[]) => {
    setChatConversations(conversations);
    if (conversations.length > 0) {
      setActiveConversationId(conversations[0].conversationId);
      setChatMessages(messages);
    } else {
      setActiveConversationId(null);
      setChatMessages([]);
    }
  }, []);

  const refreshConversations = async (videoRecordId: string) => {
    try {
      setChatConversations(await videoService.listChatConversations(videoRecordId));
    } catch { }
  };

  const streamChat = async (message: string, onChunk: (chunk: string) => void, attachments?: ChatAttachment[]) => {
    if (!id) return;
    const userMsg: ChatMsg = { id: Date.now().toString(), role: 'user', content: message, attachments: attachmentsToDisplay(attachments) };
    setChatMessages(prev => [...prev, userMsg]);
    let accumulated = '';
    try {
      // A fresh thread is persisted on its first send.
      let conversationId = activeConversationId;
      if (!conversationId) {
        const created = await videoService.createChatConversation(id);
        conversationId = created.conversationId;
        setActiveConversationId(conversationId);
      }
      await videoService.streamChat(id, message, (chunk) => {
        accumulated += chunk;
        onChunk(chunk);
      }, undefined, attachments, conversationId);
      setChatMessages(prev => [...prev, { id: String(Date.now() + 1), role: 'model', content: accumulated }]);
      refreshConversations(id); // pick up auto-title / counts / ordering
    } catch (err) {
      setChatMessages(prev => [...prev, { id: String(Date.now() + 1), role: 'model', content: getApiErrorCode(err), isError: true }]);
      throw err;
    }
  };

  const selectConversation = async (conversationId: string) => {
    if (!id || conversationId === activeConversationId) return;
    setActiveConversationId(conversationId);
    try {
      setChatMessages(await videoService.getConversationMessages(id, conversationId));
    } catch {
      setChatMessages([]);
    }
  };

  const newConversation = () => {
    setActiveConversationId(null);
    setChatMessages([]);
  };

  const deleteConversation = async (conversationId: string) => {
    if (!id) return;
    try {
      await videoService.deleteChatConversation(id, conversationId);
    } catch { return; }
    const remaining = chatConversations.filter(c => c.conversationId !== conversationId);
    setChatConversations(remaining);
    if (conversationId === activeConversationId) {
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].conversationId);
        try {
          setChatMessages(await videoService.getConversationMessages(id, remaining[0].conversationId));
        } catch {
          setChatMessages([]);
        }
      } else {
        newConversation();
      }
    }
  };

  return {
    chatMessages, chatPanelRef, streamChat,
    chatConversations, activeConversationId, selectConversation, newConversation, deleteConversation,
    applyLoadedConversations,
  };
}
