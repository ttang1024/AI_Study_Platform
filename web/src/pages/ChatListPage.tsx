import React, { useState, useCallback, useEffect } from 'react';
import {
  MessageSquare, Plus, Trash2, Sparkles, ArrowLeft,
  Bot, FileText, Youtube, Loader2, ExternalLink, Share2, Check, AlertCircle,
  Pencil, X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChatPanel } from '../components/ai/ChatPanel';
import { chatStorage, type Conversation } from '../services/chatStorage';
import { aiService, type ChatSessionSummary } from '../services/aiService';
import { documentService } from '../services/documentService';
import { youtubeService } from '../services/youtubeService';
import { STREAM_ERROR_MESSAGE } from '../services/streamSse';
import { DeleteModal } from '../components/common/DeleteModal';
import { createShare } from '../services/shareContentService';
import { cn } from '../utils/cn';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PanelMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  isError?: boolean;
}

type ActiveItem =
  | { kind: 'local'; id: string }
  | { kind: 'document'; sourceId: string; courseId: string; name: string }
  | { kind: 'video'; sourceId: string; name: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function activeItemKey(item: ActiveItem): string {
  if (item.kind === 'local') return `local-${item.id}`;
  if (item.kind === 'document') return `doc-${item.sourceId}`;
  return `vid-${item.sourceId}`;
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

// ─── Component ───────────────────────────────────────────────────────────────

export const ChatListPage: React.FC = () => {
  const [localConvs, setLocalConvs] = useState<Conversation[]>([]);
  const [backendSessions, setBackendSessions] = useState<ChatSessionSummary[]>([]);
  const [activeItem, setActiveItem] = useState<ActiveItem | null>(null);
  const [panelMessages, setPanelMessages] = useState<PanelMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showList, setShowList] = useState(true);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'creating' | 'copied' | 'error'>('idle');
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActiveItem | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // Load all sessions on mount
  useEffect(() => {
    const locals = chatStorage.getConversations();
    setLocalConvs(locals);

    aiService.getChatSessions().then(sessions => {
      setBackendSessions(sessions);

      // Auto-select most recent across all session types
      const allItems = buildListItems(locals, sessions);
      if (allItems.length > 0) {
        const first = allItems[0];
        loadMessages(first.item);
        setActiveItem(first.item);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Unified sorted list ──────────────────────────────────────────────────

  interface ListEntry {
    key: string;
    title: string;
    updatedAt: string;
    lastMessage: string;
    kind: 'local' | 'document' | 'video';
    item: ActiveItem;
  }

  function buildListItems(locals: Conversation[], backend: ChatSessionSummary[]): ListEntry[] {
    const localEntries: ListEntry[] = locals.map(c => ({
      key: `local-${c.id}`,
      title: c.title,
      updatedAt: c.updatedAt,
      lastMessage: c.messages[c.messages.length - 1]?.content ?? '',
      kind: 'local',
      item: { kind: 'local', id: c.id },
    }));

    const backendEntries: ListEntry[] = backend.map(s => ({
      key: s.sourceType === 'document' ? `doc-${s.sourceId}` : `vid-${s.sourceId}`,
      title: s.sourceName,
      updatedAt: s.updatedAt,
      lastMessage: s.lastMessage,
      kind: s.sourceType,
      item: s.sourceType === 'document'
        ? { kind: 'document', sourceId: s.sourceId, courseId: s.courseId, name: s.sourceName }
        : { kind: 'video', sourceId: s.sourceId, name: s.sourceName },
    }));

    return [...localEntries, ...backendEntries].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  const listItems = buildListItems(localConvs, backendSessions);

  // ── Load messages for the selected session ───────────────────────────────

  const loadMessages = useCallback(async (item: ActiveItem) => {
    setLoadingMessages(true);
    setPanelMessages([]);
    try {
      if (item.kind === 'local') {
        const conv = chatStorage.getConversation(item.id);
        setPanelMessages(conv?.messages ?? []);
      } else if (item.kind === 'document') {
        const msgs = await documentService.getChatHistory(item.courseId, item.sourceId);
        setPanelMessages(msgs.map(m => ({ id: m.id, role: m.role as 'user' | 'model', content: m.content })));
      } else {
        const msgs = await youtubeService.getChatHistory(item.sourceId);
        setPanelMessages(msgs.map(m => ({ id: m.id, role: m.role, content: m.content })));
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

  // ── New standalone chat ──────────────────────────────────────────────────

  const handleNewChat = useCallback(() => {
    const conv = chatStorage.createConversation();
    const all = chatStorage.getConversations();
    setLocalConvs(all);
    const item: ActiveItem = { kind: 'local', id: conv.id };
    setActiveItem(item);
    setPanelMessages([]);
    setShowList(false);
  }, []);

  // ── Conversation actions ─────────────────────────────────────────────────

  const getConversationTitle = useCallback((item: ActiveItem): string => {
    if (item.kind === 'local') {
      return chatStorage.getConversation(item.id)?.title ?? 'Chat';
    }
    return item.name;
  }, []);

  const selectAfterDelete = useCallback((deletedKey: string) => {
    const remainingItems = buildListItems(chatStorage.getConversations(), backendSessions)
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
      if (item.kind === 'local') {
        chatStorage.deleteConversation(item.id);
        setLocalConvs(chatStorage.getConversations());
      } else if (item.kind === 'document') {
        await documentService.deleteChatHistory(item.courseId, item.sourceId);
        setBackendSessions(prev => prev.filter(s => !(s.sourceType === 'document' && s.sourceId === item.sourceId)));
      } else {
        await youtubeService.deleteChatHistory(item.sourceId);
        setBackendSessions(prev => prev.filter(s => !(s.sourceType === 'video' && s.sourceId === item.sourceId)));
      }

      if (activeItem && activeItemKey(activeItem) === key) {
        selectAfterDelete(key);
      }
    } finally {
      setDeletingKey(null);
      setDeleteTarget(null);
    }
  }, [activeItem, selectAfterDelete]);

  const handleDeleteConversation = useCallback((item: ActiveItem) => {
    setDeleteTarget(item);
  }, []);

  const handleDeleteFromList = useCallback((e: React.MouseEvent, item: ActiveItem) => {
    e.stopPropagation();
    setDeleteTarget(item);
  }, []);

  const handleStartRename = useCallback((e: React.MouseEvent, entry: ListEntry) => {
    e.stopPropagation();
    if (entry.kind !== 'local') return;
    setEditingKey(entry.key);
    setRenameDraft(entry.title);
  }, []);

  const handleCancelRename = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingKey(null);
    setRenameDraft('');
  }, []);

  const handleSaveRename = useCallback((e?: React.MouseEvent | React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!editingKey?.startsWith('local-')) return;

    const conversationId = editingKey.replace(/^local-/, '');
    const nextTitle = renameDraft.trim() || 'Untitled chat';
    chatStorage.updateTitle(conversationId, nextTitle);
    setLocalConvs(chatStorage.getConversations());
    setEditingKey(null);
    setRenameDraft('');
  }, [editingKey, renameDraft]);

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
    async (message: string, onChunk: (chunk: string) => void) => {
      if (!activeItem) return;

      // Optimistically add user message to the panel
      setPanelMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'user', content: message },
      ]);

      let accumulated = '';
      let completed = false;

      try {
        if (activeItem.kind === 'local') {
          const conv = chatStorage.getConversation(activeItem.id);
          const history = (conv?.messages ?? []).map(m => ({
            role: m.role as 'user' | 'model',
            parts: [{ text: m.content }],
          }));

          chatStorage.addMessage(activeItem.id, 'user', message);
          const after = chatStorage.getConversation(activeItem.id)!;
          if (after.messages.length === 1) {
            chatStorage.updateTitle(
              activeItem.id,
              message.length > 60 ? message.slice(0, 57) + '…' : message,
            );
          }
          setLocalConvs(chatStorage.getConversations());

          await aiService.streamChat(history, message, chunk => {
            accumulated += chunk;
            onChunk(chunk);
          });
          completed = true;

          if (accumulated) chatStorage.addMessage(activeItem.id, 'model', accumulated);
          setLocalConvs(chatStorage.getConversations());

        } else if (activeItem.kind === 'document') {
          await documentService.streamChat(activeItem.courseId, activeItem.sourceId, message, chunk => {
            accumulated += chunk;
            onChunk(chunk);
          });
          completed = true;

          setBackendSessions(prev =>
            prev.map(s =>
              s.sourceType === 'document' && s.sourceId === activeItem.sourceId
                ? { ...s, lastMessage: accumulated, updatedAt: new Date().toISOString() }
                : s,
            ),
          );

        } else {
          await youtubeService.streamChat(activeItem.sourceId, message, chunk => {
            accumulated += chunk;
            onChunk(chunk);
          });
          completed = true;

          setBackendSessions(prev =>
            prev.map(s =>
              s.sourceType === 'video' && s.sourceId === activeItem.sourceId
                ? { ...s, lastMessage: accumulated, updatedAt: new Date().toISOString() }
                : s,
            ),
          );
        }
      } catch (err) {
        setPanelMessages(prev => [
          ...prev,
          { id: crypto.randomUUID(), role: 'model', content: STREAM_ERROR_MESSAGE, isError: true },
        ]);
        throw err;
      } finally {
        if (completed && accumulated) {
          setPanelMessages(prev => [
            ...prev,
            { id: crypto.randomUUID(), role: 'model', content: accumulated },
          ]);
        }
      }
    },
    [activeItem],
  );

  // ── Render ───────────────────────────────────────────────────────────────

  const activeKey = activeItem ? activeItemKey(activeItem) : null;

  return (
    <div className="flex h-full rounded-2xl border border-[var(--border-color)] overflow-hidden bg-[var(--bg-sidebar)] shadow-sm">
      {/* ── Left panel: session list ── */}
      <div
        className={cn(
          'flex flex-col border-r border-[var(--border-color)] shrink-0 w-full md:w-72',
          showList ? 'flex' : 'hidden md:flex',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-[var(--primary)]" />
            <h2 className="font-semibold text-text-main text-sm">AI Chat</h2>
          </div>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus size={13} />
            New Chat
          </button>
        </div>

        {/* Unified list */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {listItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <MessageSquare size={32} className="text-text-muted opacity-30 mb-3" />
              <p className="text-sm font-medium text-text-muted">No chats yet</p>
              <p className="text-xs text-text-muted mt-1 opacity-70">
                Click "New Chat" to start, or chat on a document/video page
              </p>
            </div>
          ) : (
            listItems.map(entry => {
              const isActive = entry.key === activeKey;
              return (
                <div
                  key={entry.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(entry.item)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelect(entry.item);
                    }
                  }}
                  onMouseEnter={() => setHoveredKey(entry.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  className={cn(
                    'group w-full cursor-pointer text-left flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/25',
                    isActive
                      ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'hover:bg-zinc-100 text-text-main',
                  )}
                >
                  {/* Source icon */}
                  <div className={cn(
                    'mt-0.5 shrink-0',
                    isActive ? 'text-[var(--primary)]' : 'text-zinc-400',
                  )}>
                    {entry.kind === 'document' && <FileText size={15} />}
                    {entry.kind === 'video' && <Youtube size={15} />}
                    {entry.kind === 'local' && <MessageSquare size={15} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    {editingKey === entry.key ? (
                      <form
                        onClick={e => e.stopPropagation()}
                        onSubmit={handleSaveRename}
                        className="flex items-center gap-1"
                      >
                        <input
                          autoFocus
                          value={renameDraft}
                          onChange={e => setRenameDraft(e.target.value)}
                          onKeyDown={e => {
                            e.stopPropagation();
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              handleCancelRename();
                            }
                          }}
                          className="min-w-0 flex-1 rounded-md border border-[var(--primary)]/30 bg-white px-2 py-1 text-sm font-medium text-text-main outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
                        />
                        <button
                          type="submit"
                          title="Save name"
                          className="shrink-0 rounded-md p-1 text-[var(--primary)] hover:bg-[var(--primary)]/10"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          title="Cancel rename"
                          onClick={handleCancelRename}
                          className="shrink-0 rounded-md p-1 text-text-muted hover:bg-zinc-100 hover:text-text-main"
                        >
                          <X size={13} />
                        </button>
                      </form>
                    ) : (
                      <>
                        <p className="text-sm font-medium truncate leading-tight">{entry.title}</p>
                        <p className="text-[11px] text-text-muted mt-0.5 truncate">{formatTime(entry.updatedAt)}</p>
                      </>
                    )}
                  </div>

                  {entry.kind === 'local' && editingKey !== entry.key && (
                    <button
                      onClick={e => handleStartRename(e, entry)}
                      title="Rename chat"
                      className={cn(
                        'shrink-0 rounded-md p-1 transition-all text-text-muted hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]',
                        hoveredKey === entry.key || isActive ? 'opacity-100' : 'sm:opacity-0',
                      )}
                    >
                      <Pencil size={13} />
                    </button>
                  )}

                  <button
                    onClick={e => handleDeleteFromList(e, entry.item)}
                    disabled={deletingKey === entry.key}
                    title="Delete chat"
                    className={cn(
                      'shrink-0 rounded-md p-1 transition-all text-text-muted hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60',
                      hoveredKey === entry.key || isActive ? 'opacity-100' : 'sm:opacity-0',
                    )}
                  >
                    {deletingKey === entry.key ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right panel: active chat ── */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0',
          !showList ? 'flex' : 'hidden md:flex',
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-3 bg-[var(--bg-sidebar)] shrink-0">
          <div className="flex items-center gap-2 min-w-0 md:hidden">
            <button
              onClick={() => setShowList(true)}
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-main transition-colors shrink-0"
            >
              <ArrowLeft size={15} />
            </button>
            <p className="truncate text-sm font-semibold text-text-main">
              {activeItem ? getConversationTitle(activeItem) : 'AI Chat'}
            </p>
          </div>
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-sm font-semibold text-text-main">
              {activeItem ? getConversationTitle(activeItem) : 'AI Chat'}
            </p>
          </div>
          {activeItem && (
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={handleShareActive}
                disabled={shareStatus === 'creating'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-white px-3 py-1.5 text-xs font-semibold text-text-main hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                title={shareStatus === 'creating' ? 'Creating link…' : shareStatus === 'copied' ? 'Link copied!' : shareStatus === 'error' ? 'Unable to share' : 'Share conversation'}
              >
                {shareStatus === 'creating'
                  ? <Loader2 size={14} className="animate-spin" />
                  : shareStatus === 'idle'
                    ? <Share2 size={14} />
                    : shareStatus === 'error'
                      ? <AlertCircle size={14} />
                      : <Check size={14} />}
                <span className="hidden sm:inline">
                  {shareStatus === 'creating'
                    ? 'Creating'
                    : shareStatus === 'copied'
                      ? 'Link copied'
                      : shareStatus === 'error'
                        ? 'Unable to share'
                        : 'Share'}
                </span>
              </button>
              <button
                onClick={() => handleDeleteConversation(activeItem)}
                disabled={deletingKey === activeKey}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingKey === activeKey ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
          )}
        </div>

        {loadingMessages ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <Loader2 size={28} className="animate-spin text-[var(--primary)] mb-3" />
            <p className="text-sm text-text-muted">Loading messages…</p>
          </div>
        ) : activeItem ? (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Source label for document/video sessions */}
            {(activeItem.kind === 'document' || activeItem.kind === 'video') && (
              <div className="flex items-center gap-2 border-b border-[var(--border-color)] px-4 py-2 bg-[var(--bg-app)] shrink-0">
                {activeItem.kind === 'document'
                  ? <FileText size={14} className="text-[var(--primary)] shrink-0" />
                  : <Youtube size={14} className="text-[var(--primary)] shrink-0" />}
                <span className="text-xs text-text-muted flex-1 min-w-0">
                  {activeItem.kind === 'document' ? 'Document' : 'YouTube'} ·{' '}
                  <Link
                    to={activeItem.kind === 'document'
                      ? `/documents/${activeItem.sourceId}`
                      : `/youtube/${activeItem.sourceId}`}
                    state={{ activeTab: 'chat' }}
                    className="font-medium text-text-main hover:text-[var(--primary)] hover:underline transition-colors"
                  >
                    {activeItem.name}
                  </Link>
                </span>
                <Link
                  to={activeItem.kind === 'document'
                    ? `/documents/${activeItem.sourceId}`
                    : `/youtube/${activeItem.sourceId}`}
                  state={{ activeTab: 'chat' }}
                  title="Open detail page"
                  className="shrink-0 text-text-muted hover:text-[var(--primary)] transition-colors"
                >
                  <ExternalLink size={13} />
                </Link>
              </div>
            )}
            <div className="flex-1 min-h-0">
              <ChatPanel
                key={activeKey!}
                externalMessages={panelMessages}
                onExternalStreamSend={handleStreamSend}
                placeholder="Ask anything…"
                hideHeader
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-center p-10">
            <div className="mb-5 rounded-2xl bg-[var(--primary)]/10 p-5 text-[var(--primary)]">
              <Sparkles size={36} />
            </div>
            <h3 className="text-lg font-semibold text-text-main mb-2">Start a Conversation</h3>
            <p className="text-sm text-text-muted mb-6 max-w-xs leading-relaxed">
              Chat with your AI tutor. Ask questions, get explanations, and explore any topic.
              Your chats from document and video pages also appear here.
            </p>
            <button
              onClick={handleNewChat}
              className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-md"
            >
              <Plus size={16} />
              New Chat
            </button>
          </div>
        )}
      </div>

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
  );
};
