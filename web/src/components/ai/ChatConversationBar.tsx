import { useEffect, useRef, useState } from 'react';
import { ChevronDown, History, MessageSquarePlus, Trash2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { ChatThreadSummary } from '../../types';

interface ChatConversationBarProps {
  conversations: ChatThreadSummary[];
  /** null while composing a fresh, not-yet-persisted thread */
  activeId: string | null;
  onSelect: (conversationId: string) => void;
  onNew: () => void;
  onDelete: (conversationId: string) => void;
}

/** Thread switcher above the chat: pick an earlier conversation, start a new one, delete old ones. */
export function ChatConversationBar({ conversations, activeId, onSelect, onNew, onDelete }: ChatConversationBarProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const active = conversations.find(c => c.conversationId === activeId);

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] shrink-0">
      <div className="relative flex-1 min-w-0" ref={menuRef}>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1.5 text-left hover:border-[var(--primary)]/40 transition-colors"
          title="Conversation history"
        >
          <History size={14} className="shrink-0 text-text-muted" />
          <span className="flex-1 truncate text-xs font-medium text-text-main">
            {active ? active.title : 'New conversation'}
          </span>
          <ChevronDown size={14} className={cn('shrink-0 text-text-muted transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute z-30 mt-1 left-0 right-0 max-h-64 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-lg">
            {conversations.length === 0 && (
              <div className="px-3 py-2.5 text-xs text-text-muted">No conversations yet — ask something to start one.</div>
            )}
            {conversations.map(c => (
              <div
                key={c.conversationId}
                onClick={() => { onSelect(c.conversationId); setOpen(false); }}
                className={cn(
                  'group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--primary)]/5',
                  c.conversationId === activeId && 'bg-[var(--primary)]/8',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className={cn('truncate text-xs font-medium', c.conversationId === activeId ? 'text-[var(--primary)]' : 'text-text-main')}>
                    {c.title}
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {new Date(c.updatedAt).toLocaleString()} · {c.messageCount} message{c.messageCount === 1 ? '' : 's'}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(c.conversationId); }}
                  className="opacity-0 group-hover:opacity-100 shrink-0 rounded-md p-1 text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-all"
                  title="Delete conversation"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onNew}
        className="flex items-center gap-1.5 shrink-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-medium text-text-main hover:border-[var(--primary)]/40 hover:text-[var(--primary)] transition-colors"
        title="Start a new conversation"
      >
        <MessageSquarePlus size={14} />
        New
      </button>
    </div>
  );
}
