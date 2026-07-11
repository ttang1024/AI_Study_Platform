import React, { useState, useCallback, useEffect } from 'react';
import { MessageSquare, GraduationCap } from 'lucide-react';
import { TeachBackMode } from '../components/tutor/TeachBackMode';
import { aiService, attachmentsToDisplay, type ChatSessionSummary, type ChatAttachment, type ChatMessageAttachment } from '../services/aiService';
import { documentService } from '../services/documentService';
import { videoService } from '../services/videoService';
import { STREAM_ERROR_MESSAGE } from '../services/streamSse';
import { DeleteModal } from '../components/common/DeleteModal';
import { createShare } from '../services/shareContentService';
import { cn } from '../utils/cn';
import { ChatActivePanel } from '../components/chat/ChatActivePanel';
import { ChatSessionList } from '../components/chat/ChatSessionList';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PanelMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  isError?: boolean;
  attachments?: ChatMessageAttachment[];
}

export type ActiveItem =
  | { kind: 'general'; sourceId: string; name: string }
  | { kind: 'document'; sourceId: string; courseId: string; name: string; conversationId: string; threadTitle: string }
  | { kind: 'video'; sourceId: string; name: string; conversationId: string; threadTitle: string };

/** Page-level mode: regular conversations or Feynman teach-back. */
type PageTab = 'chats' | 'teach-back';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function activeItemKey(item: ActiveItem): string {
  if (item.kind === 'general') return `general-${item.sourceId}`;
  if (item.kind === 'document') return `doc-${item.conversationId}`;
  return `vid-${item.conversationId}`;
}

function createConversationId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createMessageId(): string {
  return createConversationId();
}

function titleFromMessage(message: string): string {
  const compact = message.trim().replace(/\s+/g, ' ');
  return compact.length > 42 ? `${compact.slice(0, 39)}...` : compact || 'New conversation';
}

function formatConversationForShare(messages: PanelMessage[]): string {
  const visibleMessages = messages.filter(message => !message.isError && message.content.trim());

  return JSON.stringify({
    type: 'chat-transcript',
    version: 1,
    messages: visibleMessages.map(message => ({
      role: message.role,
      content: message.content,
    })),
  });
}

// ─── Unified sorted list ─────────────────────────────────────────────────────

export interface ListEntry {
  key: string;
  title: string;
  sourceName: string;
  updatedAt: string;
  lastMessage: string;
  kind: 'general' | 'document' | 'video';
  item: ActiveItem;
}

function buildListItems(backend: ChatSessionSummary[]): ListEntry[] {
  // Each entry is one conversation thread; a document/video can have several.
  return backend.filter(s => s.messageCount > 0).map(s => ({
      key: s.sourceType === 'general'
        ? `general-${s.sourceId}`
        : s.sourceType === 'document'
          ? `doc-${s.conversationId}`
          : `vid-${s.conversationId}`,
      title: s.sourceType === 'general' ? s.sourceName : (s.conversationTitle || s.sourceName),
      sourceName: s.sourceName,
      updatedAt: s.updatedAt,
      lastMessage: s.lastMessage,
      kind: s.sourceType as 'general' | 'document' | 'video',
      item: s.sourceType === 'general'
        ? { kind: 'general' as const, sourceId: s.sourceId, name: s.sourceName }
        : s.sourceType === 'document'
          ? { kind: 'document' as const, sourceId: s.sourceId, courseId: s.courseId ?? '', name: s.sourceName, conversationId: s.conversationId, threadTitle: s.conversationTitle }
          : { kind: 'video' as const, sourceId: s.sourceId, name: s.sourceName, conversationId: s.conversationId, threadTitle: s.conversationTitle },
    })).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export const ChatListPage: React.FC = () => {
  const [pageTab, setPageTab] = useState<PageTab>(() => {
    // /tutor redirects here with ?tab=teach-back.
    const t = new URLSearchParams(window.location.search).get('tab');
    return t === 'teach-back' ? t : 'chats';
  });
  const [backendSessions, setBackendSessions] = useState<ChatSessionSummary[]>([]);
  const [activeItem, setActiveItem] = useState<ActiveItem | null>(null);
  const [panelMessages, setPanelMessages] = useState<PanelMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showList, setShowList] = useState(true);
  const [shareStatus, setShareStatus] = useState<'idle' | 'creating' | 'copied' | 'error'>('idle');
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActiveItem | null>(null);

  // Load all sessions on mount
  useEffect(() => {
    aiService.getChatSessions().then(sessions => {
      setBackendSessions(sessions);
      const allItems = buildListItems(sessions);
      if (allItems.length > 0) {
        const first = allItems[0];
        loadMessages(first.item);
        setActiveItem(first.item);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listItems = buildListItems(backendSessions);

  // ── Load messages for the selected session ───────────────────────────────

  const loadMessages = useCallback(async (item: ActiveItem) => {
    setLoadingMessages(true);
    setPanelMessages([]);
    try {
      if (item.kind === 'general') {
        const msgs = await aiService.getGeneralChatHistory(item.sourceId);
        setPanelMessages(msgs.map(m => ({
          id: m.messageId,
          role: m.role === 'user' ? 'user' : 'model',
          content: m.content,
          attachments: m.attachments ?? undefined,
        })));
      } else if (item.kind === 'document') {
        const msgs = await documentService.getConversationMessages(item.courseId, item.sourceId, item.conversationId);
        setPanelMessages(msgs.map(m => ({ id: m.id, role: m.role as 'user' | 'model', content: m.content, attachments: m.attachments })));
      } else {
        const msgs = await videoService.getConversationMessages(item.sourceId, item.conversationId);
        setPanelMessages(msgs.map(m => ({ id: m.id, role: m.role, content: m.content, attachments: m.attachments })));
      }
    } catch {
      setPanelMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // ── Select a session ─────────────────────────────────────────────────────

  const handleSelect = useCallback((item: ActiveItem) => {
    setActiveItem(item);
    setShowList(false);
    setShareStatus('idle');
    loadMessages(item);
  }, [loadMessages]);

  const handleNewConversation = useCallback(async () => {
    const conversation = await aiService.createGeneralChatConversation();
    const now = conversation.updatedAt;
    const item: ActiveItem = { kind: 'general', sourceId: conversation.conversationId, name: conversation.title };

    setBackendSessions(prev => [{
      sourceType: 'general',
      sourceId: conversation.conversationId,
      sourceName: conversation.title,
      courseId: null,
      conversationId: conversation.conversationId,
      conversationTitle: conversation.title,
      lastMessage: '',
      lastMessageRole: '',
      updatedAt: now,
      messageCount: 0,
    }, ...prev]);
    setActiveItem(item);
    setPanelMessages([]);
    setShareStatus('idle');
    setShowList(false);
  }, []);

  // ── Conversation actions ─────────────────────────────────────────────────

  const getConversationTitle = useCallback((item: ActiveItem): string => {
    if (item.kind === 'general') return item.name;
    return item.threadTitle || item.name;
  }, []);

  const selectAfterDelete = useCallback((deletedKey: string, nextBackendSessions = backendSessions) => {
    const remainingItems = buildListItems(nextBackendSessions)
      .filter(entry => entry.key !== deletedKey);

    if (remainingItems.length > 0) {
      handleSelect(remainingItems[0].item);
    } else {
      setActiveItem(null);
      setPanelMessages([]);
      setShowList(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendSessions, handleSelect]);

  const deleteConversation = useCallback(async (item: ActiveItem) => {
    const key = activeItemKey(item);

    setDeletingKey(key);
    try {
      if (item.kind === 'general') {
        await aiService.deleteGeneralChatConversation(item.sourceId);
        const nextBackendSessions = backendSessions.filter(s => !(s.sourceType === 'general' && s.sourceId === item.sourceId));
        setBackendSessions(nextBackendSessions);
        if (activeItem && activeItemKey(activeItem) === key) {
          selectAfterDelete(key, nextBackendSessions);
        }
      } else if (item.kind === 'document') {
        await documentService.deleteChatConversation(item.courseId, item.sourceId, item.conversationId);
        const nextBackendSessions = backendSessions.filter(s => !(s.sourceType === 'document' && s.conversationId === item.conversationId));
        setBackendSessions(nextBackendSessions);
        if (activeItem && activeItemKey(activeItem) === key) {
          selectAfterDelete(key, nextBackendSessions);
        }
      } else {
        await videoService.deleteChatConversation(item.sourceId, item.conversationId);
        const nextBackendSessions = backendSessions.filter(s => !(s.sourceType === 'video' && s.conversationId === item.conversationId));
        setBackendSessions(nextBackendSessions);
        if (activeItem && activeItemKey(activeItem) === key) {
          selectAfterDelete(key, nextBackendSessions);
        }
      }
    } finally {
      setDeletingKey(null);
      setDeleteTarget(null);
    }
  }, [activeItem, backendSessions, selectAfterDelete]);

  const handleDeleteConversation = useCallback((item: ActiveItem) => {
    setDeleteTarget(item);
  }, []);

  const handleDeleteFromList = useCallback((e: React.MouseEvent, item: ActiveItem) => {
    e.stopPropagation();
    setDeleteTarget(item);
  }, []);

  const handleShareActive = useCallback(async () => {
    if (!activeItem) return;

    const title = getConversationTitle(activeItem);
    const shareableMessages = panelMessages.filter(message => !message.isError && message.content.trim());
    if (shareableMessages.length === 0) {
      setShareStatus('error');
      window.setTimeout(() => setShareStatus('idle'), 2200);
      return;
    }

    setShareStatus('creating');
    try {
      const result = await createShare({
        title,
        notesHtml: formatConversationForShare(shareableMessages),
        sourceType: 'chat',
      });
      await navigator.clipboard.writeText(result.shareUrl);
      setShareStatus('copied');
    } catch {
      setShareStatus('error');
    } finally {
      window.setTimeout(() => setShareStatus('idle'), 2600);
    }
  }, [activeItem, getConversationTitle, panelMessages]);

  // ── Send handler (unified for all session types) ─────────────────────────

  const handleStreamSend = useCallback(
    async (message: string, onChunk: (chunk: string) => void, attachments?: ChatAttachment[]) => {
      if (!activeItem) return;

      const turnAttachments = attachments && attachments.length > 0 ? attachments : undefined;
      // Title source falls back to the first file name when the turn is attachments-only.
      const titleSource = message.trim() || turnAttachments?.[0]?.fileName || 'Attachment';
      // Optimistically add user message to the panel, with inline thumbnails for any attachments.
      const userMessage: PanelMessage = {
        id: createMessageId(),
        role: 'user',
        content: message,
        attachments: attachmentsToDisplay(turnAttachments),
      };
      setPanelMessages(prev => [
        ...prev,
        userMessage,
      ]);

      let accumulated = '';
      let completed = false;

      try {
        if (activeItem.kind === 'general') {
          await aiService.streamGeneralChatConversation(activeItem.sourceId, message, chunk => {
            accumulated += chunk;
            onChunk(chunk);
          }, undefined, turnAttachments);
          completed = true;
        } else if (activeItem.kind === 'document') {
          await documentService.streamChat(activeItem.courseId, activeItem.sourceId, message, chunk => {
            accumulated += chunk;
            onChunk(chunk);
          }, undefined, turnAttachments, activeItem.conversationId);
          completed = true;
        } else {
          await videoService.streamChat(activeItem.sourceId, message, chunk => {
            accumulated += chunk;
            onChunk(chunk);
          }, undefined, turnAttachments, activeItem.conversationId);
          completed = true;
        }
      } catch (err) {
        const errorMessage: PanelMessage = { id: createMessageId(), role: 'model', content: STREAM_ERROR_MESSAGE, isError: true };
        setPanelMessages(prev => [
          ...prev,
          errorMessage,
        ]);
        if (activeItem.kind === 'general') {
          const updatedAt = new Date().toISOString();
          setBackendSessions(prev => prev.map(session =>
            session.sourceType === 'general' && session.sourceId === activeItem.sourceId
              ? {
                ...session,
                sourceName: session.messageCount === 0 ? titleFromMessage(titleSource) : session.sourceName,
                lastMessage: STREAM_ERROR_MESSAGE,
                lastMessageRole: 'assistant',
                updatedAt,
                messageCount: session.messageCount + 2,
              }
              : session,
          ));
        }
        throw err;
      } finally {
        if (completed && accumulated) {
          const modelMessage: PanelMessage = { id: createMessageId(), role: 'model', content: accumulated };
          setPanelMessages(prev => [
            ...prev,
            modelMessage,
          ]);
          const updatedAt = new Date().toISOString();
          const nextTitle = titleFromMessage(titleSource);
          if (activeItem.kind === 'general') {
            const shouldRetitle = backendSessions.find(session =>
              session.sourceType === 'general' && session.sourceId === activeItem.sourceId,
            )?.messageCount === 0;
            setBackendSessions(prev => prev.map(session =>
              session.sourceType === 'general' && session.sourceId === activeItem.sourceId
                ? {
                  ...session,
                  sourceName: shouldRetitle ? nextTitle : session.sourceName,
                  lastMessage: accumulated,
                  lastMessageRole: 'assistant',
                  updatedAt,
                  messageCount: session.messageCount + 2,
                }
                : session,
            ));
            setActiveItem(prev => prev && prev.kind === 'general' && prev.sourceId === activeItem.sourceId
              ? { ...prev, name: shouldRetitle ? nextTitle : prev.name }
              : prev);
          } else {
            // The server titles a thread from its first message; mirror that here.
            const shouldRetitle = backendSessions.find(session =>
              session.sourceType === activeItem.kind && session.conversationId === activeItem.conversationId,
            )?.messageCount === 0;
            setBackendSessions(prev => prev.map(session =>
              session.sourceType === activeItem.kind && session.conversationId === activeItem.conversationId
                ? {
                  ...session,
                  conversationTitle: shouldRetitle ? nextTitle : session.conversationTitle,
                  lastMessage: accumulated,
                  lastMessageRole: 'assistant',
                  updatedAt,
                  messageCount: session.messageCount + 2,
                }
                : session,
            ));
            setActiveItem(prev => prev && prev.kind !== 'general' && prev.conversationId === activeItem.conversationId
              ? { ...prev, threadTitle: shouldRetitle ? nextTitle : prev.threadTitle }
              : prev);
          }
        }
      }
    },
    [activeItem, backendSessions],
  );

  // ── Render ───────────────────────────────────────────────────────────────

  const activeKey = activeItem ? activeItemKey(activeItem) : null;

  return (
    <div className="flex h-full flex-col gap-3">
      {/* ── Mode tabs: conversations / teach-back ── */}
      <div className="flex items-center gap-2 shrink-0">
        {([
          ['chats', 'Conversations', MessageSquare],
          ['teach-back', 'Teach-back', GraduationCap],
        ] as [PageTab, string, React.ElementType][]).map(([tab, label, Icon]) => (
          <button
            key={tab}
            onClick={() => setPageTab(tab)}
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-colors',
              pageTab === tab
                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                : 'border-[var(--border-color)] bg-[var(--bg-sidebar)] text-text-muted hover:text-text-main',
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {pageTab === 'teach-back' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <TeachBackMode />
        </div>
      )}

      {pageTab === 'chats' && (
    <div className="flex flex-1 min-h-0 rounded-2xl border border-[var(--border-color)] overflow-hidden bg-[var(--bg-sidebar)] shadow-sm">
      {/* ── Left panel: session list ── */}
      <ChatSessionList
        showList={showList}
        listItems={listItems}
        activeKey={activeKey}
        deletingKey={deletingKey}
        handleSelect={handleSelect}
        handleNewConversation={handleNewConversation}
        handleDeleteFromList={handleDeleteFromList}
      />

      {/* ── Right panel: active chat ── */}
      <ChatActivePanel
        showList={showList}
        setShowList={setShowList}
        activeItem={activeItem}
        activeKey={activeKey}
        getConversationTitle={getConversationTitle}
        handleNewConversation={handleNewConversation}
        handleShareActive={handleShareActive}
        shareStatus={shareStatus}
        handleDeleteConversation={handleDeleteConversation}
        deletingKey={deletingKey}
        loadingMessages={loadingMessages}
        panelMessages={panelMessages}
        handleStreamSend={handleStreamSend}
      />

      <DeleteModal
        isOpen={!!deleteTarget}
        title="Delete conversation"
        itemName={deleteTarget ? getConversationTitle(deleteTarget) : undefined}
        description={
          deleteTarget ? (
            <>
              Delete <span className="font-semibold text-zinc-800 break-words">"{getConversationTitle(deleteTarget)}"</span>?{' '}
              This will remove the conversation history.
            </>
          ) : undefined
        }
        confirmLabel="Delete"
        isDeleting={!!deleteTarget && deletingKey === activeItemKey(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void deleteConversation(deleteTarget);
        }}
      />
    </div>
      )}
    </div>
  );
};
