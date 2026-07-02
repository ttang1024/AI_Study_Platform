import { useEffect, useState } from 'react';
import { documentService } from '../../services/documentService';
import { attachmentsToDisplay, type ChatAttachment, type ChatMessageAttachment } from '../../services/aiService';
import { getApiErrorCode } from '../../utils/apiError';
import type { ChatThreadSummary } from '../../types';

export interface ThreadChatMsg {
  id: string;
  role: 'user' | 'model';
  content: string;
  isError?: boolean;
  attachments?: ChatMessageAttachment[];
}

/**
 * Multiple chat conversations (threads) for a document-backed source — the
 * document, audio and article pages all share this. Loads the most recent
 * thread on mount; a fresh thread (activeId === null) is persisted on first
 * send. Wire `streamChat` into ChatPanel's onExternalStreamSend.
 */
export function useDocumentChatThreads(courseId: string | null | undefined, documentId: string | null | undefined) {
  const [messages, setMessages] = useState<ThreadChatMsg[]>([]);
  const [conversations, setConversations] = useState<ChatThreadSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  useEffect(() => {
    setMessages([]);
    setConversations([]);
    setActiveConversationId(null);
    if (!courseId || !documentId) return;
    let stale = false;
    (async () => {
      try {
        const threads = await documentService.listChatConversations(courseId, documentId);
        if (stale) return;
        setConversations(threads);
        if (threads.length > 0) {
          setActiveConversationId(threads[0].conversationId);
          const history = await documentService.getConversationMessages(courseId, documentId, threads[0].conversationId);
          if (!stale) setMessages(history);
        }
      } catch { }
    })();
    return () => { stale = true; };
  }, [courseId, documentId]);

  const refreshConversations = async () => {
    if (!courseId || !documentId) return;
    try {
      setConversations(await documentService.listChatConversations(courseId, documentId));
    } catch { }
  };

  const streamChat = async (message: string, onChunk: (chunk: string) => void, attachments?: ChatAttachment[]) => {
    if (!courseId || !documentId) return;
    const userMsg: ThreadChatMsg = { id: Date.now().toString(), role: 'user', content: message, attachments: attachmentsToDisplay(attachments) };
    setMessages(prev => [...prev, userMsg]);
    let accumulated = '';
    try {
      // A fresh thread is persisted on its first send.
      let conversationId = activeConversationId;
      if (!conversationId) {
        const created = await documentService.createChatConversation(courseId, documentId);
        conversationId = created.conversationId;
        setActiveConversationId(conversationId);
      }
      await documentService.streamChat(courseId, documentId, message, (chunk) => {
        accumulated += chunk;
        onChunk(chunk);
      }, undefined, attachments, conversationId);
      setMessages(prev => [...prev, { id: String(Date.now() + 1), role: 'model', content: accumulated }]);
      refreshConversations(); // pick up auto-title / counts / ordering
    } catch (err) {
      setMessages(prev => [...prev, { id: String(Date.now() + 1), role: 'model', content: getApiErrorCode(err), isError: true }]);
      throw err;
    }
  };

  const selectConversation = async (conversationId: string) => {
    if (!courseId || !documentId || conversationId === activeConversationId) return;
    setActiveConversationId(conversationId);
    try {
      setMessages(await documentService.getConversationMessages(courseId, documentId, conversationId));
    } catch {
      setMessages([]);
    }
  };

  const newConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
  };

  const deleteConversation = async (conversationId: string) => {
    if (!courseId || !documentId) return;
    try {
      await documentService.deleteChatConversation(courseId, documentId, conversationId);
    } catch { return; }
    const remaining = conversations.filter(c => c.conversationId !== conversationId);
    setConversations(remaining);
    if (conversationId === activeConversationId) {
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].conversationId);
        try {
          setMessages(await documentService.getConversationMessages(courseId, documentId, remaining[0].conversationId));
        } catch {
          setMessages([]);
        }
      } else {
        newConversation();
      }
    }
  };

  return {
    messages,
    conversations,
    activeConversationId,
    streamChat,
    selectConversation,
    newConversation,
    deleteConversation,
  };
}
