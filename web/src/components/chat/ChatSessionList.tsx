import React, { useState } from 'react';
import { MessageSquare, Trash2, Sparkles, Bot, FileText, Youtube, Loader2, Plus } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { ActiveItem, ListEntry } from '../../pages/ChatListPage';

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

interface ChatSessionListProps {
  showList: boolean;
  listItems: ListEntry[];
  activeKey: string | null;
  deletingKey: string | null;
  handleSelect: (item: ActiveItem) => void;
  handleNewConversation: () => void;
  handleDeleteFromList: (e: React.MouseEvent, item: ActiveItem) => void;
}

export const ChatSessionList: React.FC<ChatSessionListProps> = ({
  showList, listItems, activeKey, deletingKey,
  handleSelect, handleNewConversation, handleDeleteFromList,
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <div
      className={cn(
        'flex flex-col border-r border-[var(--border-color)] shrink-0 w-full md:w-72',
        showList ? 'flex' : 'hidden md:flex',
      )}
    >
      {/* Header */}
      <div className="flex items-center border-b border-[var(--border-color)] px-4 py-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Bot size={18} className="text-[var(--primary)]" />
          <h2 className="font-semibold text-text-main text-sm">AI Chat</h2>
        </div>
        <button
          onClick={handleNewConversation}
          title="New conversation"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)] bg-white text-text-main transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Unified list */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {listItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <MessageSquare size={32} className="text-text-muted opacity-30 mb-3" />
            <p className="text-sm font-medium text-text-muted">No chats yet</p>
            <p className="text-xs text-text-muted mt-1 opacity-70">
              Start a new conversation or chat from a document or video page
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
                <div className={cn('mt-0.5 shrink-0', isActive ? 'text-[var(--primary)]' : 'text-zinc-400')}>
                  {entry.kind === 'general' && <Sparkles size={15} />}
                  {entry.kind === 'document' && <FileText size={15} />}
                  {entry.kind === 'video' && <Youtube size={15} />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate leading-tight">{entry.title}</p>
                  <p className="text-[11px] text-text-muted mt-0.5 truncate">
                    {entry.kind !== 'general' && entry.title !== entry.sourceName
                      ? `${entry.sourceName} · ${formatTime(entry.updatedAt)}`
                      : formatTime(entry.updatedAt)}
                  </p>
                </div>

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
  );
};
