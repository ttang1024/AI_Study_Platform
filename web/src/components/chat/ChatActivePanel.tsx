import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Share2, Loader2, AlertCircle, Check, Trash2, FileText, Youtube, ExternalLink, Sparkles } from 'lucide-react';
import { cn } from '../../utils/cn';
import { ChatPanel } from '../ai/ChatPanel';
import type { ChatAttachment } from '../../services/aiService';
import type { ActiveItem, PanelMessage } from '../../pages/ChatListPage';

interface ChatActivePanelProps {
  showList: boolean;
  setShowList: (v: boolean) => void;
  activeItem: ActiveItem | null;
  activeKey: string | null;
  getConversationTitle: (item: ActiveItem) => string;
  handleNewConversation: () => void;
  handleShareActive: () => void;
  shareStatus: 'idle' | 'creating' | 'copied' | 'error';
  handleDeleteConversation: (item: ActiveItem) => void;
  deletingKey: string | null;
  loadingMessages: boolean;
  panelMessages: PanelMessage[];
  handleStreamSend: (message: string, onChunk: (chunk: string) => void, attachments?: ChatAttachment[]) => Promise<void>;
}

export const ChatActivePanel: React.FC<ChatActivePanelProps> = ({
  showList,
  setShowList,
  activeItem,
  activeKey,
  getConversationTitle,
  handleNewConversation,
  handleShareActive,
  shareStatus,
  handleDeleteConversation,
  deletingKey,
  loadingMessages,
  panelMessages,
  handleStreamSend,
}) => (
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
          {!activeItem && (
            <button
              onClick={handleNewConversation}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-white px-3 py-1.5 text-xs font-semibold text-text-main transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
            >
              <Plus size={14} />
              New
            </button>
          )}
          {activeItem && (
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={handleNewConversation}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-white px-3 py-1.5 text-xs font-semibold text-text-main transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">New</span>
              </button>
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
            {/* Source label */}
            {activeItem.kind !== 'general' && (
              <div className="flex items-center gap-2 border-b border-[var(--border-color)] px-4 py-2 bg-[var(--bg-app)] shrink-0">
                {activeItem.kind === 'document'
                  ? <FileText size={14} className="text-[var(--primary)] shrink-0" />
                  : <Youtube size={14} className="text-[var(--primary)] shrink-0" />}
                <span className="text-xs text-text-muted flex-1 min-w-0">
                  {activeItem.kind === 'document' ? 'Document' : 'YouTube'} ·{' '}
                  <Link
                    to={activeItem.kind === 'document'
                      ? `/documents/${activeItem.sourceId}`
                      : `/videos/${activeItem.sourceId}`}
                    state={{ activeTab: 'chat' }}
                    className="font-medium text-text-main hover:text-[var(--primary)] hover:underline transition-colors"
                  >
                    {activeItem.name}
                  </Link>
                </span>
                <Link
                  to={activeItem.kind === 'document'
                    ? `/documents/${activeItem.sourceId}`
                    : `/videos/${activeItem.sourceId}`}
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
                enableAttachments
                placeholder={activeItem.kind === 'general' ? 'Start a new study conversation...' : 'Ask anything…'}
                hideHeader
                hideAddToNotes
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-center p-10">
            <div className="mb-5 rounded-2xl bg-[var(--primary)]/10 p-5 text-[var(--primary)]">
              <Sparkles size={36} />
            </div>
            <h3 className="text-lg font-semibold text-text-main mb-2">Select a Conversation</h3>
            <p className="text-sm text-text-muted max-w-xs leading-relaxed">
              Select a chat from the list, or start a new conversation.
            </p>
            <button
              onClick={handleNewConversation}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Plus size={16} />
              New conversation
            </button>
          </div>
        )}
      </div>
);
