import React from 'react';
import { Sparkles, User, Copy, Plus, Check, AlertCircle, Volume2, Square, FileText } from 'lucide-react';
import type { ChatMessageAttachment } from '../../services/aiService';
import type { ChatPanelMessage } from './chatTypes';
import { ChatBubbleMarkdown } from './ChatBubbleMarkdown';
import { cn } from '../../utils/cn';

interface ChatMessageRowProps {
  msg: ChatPanelMessage;
  copied: boolean;
  onCopy: (id: string, text: string) => void;
  speakingId: string | null;
  onSpeak: (id: string, content: string) => void;
  showAddToNotes: boolean;
  onAddToNotes: (content: string) => void;
  onPreviewAttachment: (att: ChatMessageAttachment) => void;
}

/** One message in the chat scrollback: avatar, bubble, and hover actions. */
export const ChatMessageRow: React.FC<ChatMessageRowProps> = ({
  msg, copied, onCopy, speakingId, onSpeak, showAddToNotes, onAddToNotes, onPreviewAttachment,
}) => (
  <div
    className={cn(
      'flex gap-3',
      msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
    )}
  >
    <div className={cn(
      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs',
      msg.role === 'user'
        ? 'bg-[var(--bg-sidebar)] text-text-muted border border-[var(--border-color)]'
        : msg.isError
          ? 'bg-red-500/10 text-red-500'
          : 'bg-[var(--primary)] text-white'
    )}>
      {msg.role === 'user' ? <User size={14} /> : msg.isError ? <AlertCircle size={14} /> : <Sparkles size={14} />}
    </div>
    <div className="flex flex-col gap-1 max-w-[85%]">
      <div className={cn(
        'rounded-[var(--radius)] px-4 py-2 text-sm leading-relaxed',
        msg.role === 'user'
          ? 'bg-[var(--bg-sidebar)] text-text-main border border-[var(--border-color)] rounded-tr-none'
          : msg.isError
            ? 'bg-red-500/10 text-red-500 border border-red-500/20 rounded-tl-none'
            : 'bg-[var(--primary)]/10 text-text-main border border-[var(--primary)]/20 rounded-tl-none'
      )}>
        {msg.role === 'model' ? (
          <ChatBubbleMarkdown>{msg.content}</ChatBubbleMarkdown>
        ) : (
          <>
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-1.5 last:mb-0">
                {msg.attachments.map((att, i) => (
                  att.mimeType.startsWith('image/') ? (
                    <button key={i} type="button" onClick={() => onPreviewAttachment(att)} title={att.fileName ?? 'attachment'} className="block">
                      <img
                        src={att.url}
                        alt={att.fileName ?? 'attachment'}
                        className="max-h-40 max-w-[200px] cursor-zoom-in rounded-lg border border-[var(--border-color)] object-cover transition-opacity hover:opacity-90"
                      />
                    </button>
                  ) : (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onPreviewAttachment(att)}
                      title={`Preview ${att.fileName ?? 'attachment'}`}
                      className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-2.5 py-1.5 text-xs text-text-main transition-colors hover:border-[var(--primary)]"
                    >
                      <FileText size={16} className="shrink-0 text-[var(--primary)]" />
                      <span className="max-w-[160px] truncate">{att.fileName ?? 'attachment'}</span>
                    </button>
                  )
                ))}
              </div>
            )}
            {msg.content}
          </>
        )}
      </div>
      <div className={cn(
        "flex items-center gap-2 px-1",
        msg.role === 'user' ? "flex-row-reverse" : "flex-row"
      )}>
        <button
          onClick={() => onCopy(msg.id, msg.content)}
          className="p-1.5 rounded-lg hover:bg-zinc-100 text-text-muted transition-all flex items-center justify-center border border-transparent hover:border-[var(--border-color)] group relative"
          title={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
        >
          {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          <div className="absolute bottom-full mb-2 hidden group-hover:block z-50">
            <div className="bg-zinc-900 text-white text-[10px] py-1 px-2 rounded shadow-lg whitespace-nowrap">
              {copied ? 'Copied' : 'Copy'}
            </div>
          </div>
        </button>
        {msg.role === 'model' && !msg.isError && (
          <button
            onClick={() => onSpeak(msg.id, msg.content)}
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-text-muted transition-all flex items-center justify-center border border-transparent hover:border-[var(--border-color)] group relative"
            title={speakingId === msg.id ? 'Stop reading' : 'Read aloud'}
          >
            {speakingId === msg.id ? <Square size={14} className="text-[var(--primary)]" /> : <Volume2 size={14} />}
            <div className="absolute bottom-full mb-2 hidden group-hover:block z-50">
              <div className="bg-zinc-900 text-white text-[10px] py-1 px-2 rounded shadow-lg whitespace-nowrap">
                {speakingId === msg.id ? 'Stop' : 'Read aloud'}
              </div>
            </div>
          </button>
        )}
        {msg.role === 'model' && !msg.isError && showAddToNotes && (
          <button
            onClick={() => onAddToNotes(msg.content)}
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-text-muted transition-all flex items-center justify-center border border-transparent hover:border-[var(--border-color)] group relative"
            title="Add to notes"
          >
            <Plus size={14} />
            <div className="absolute bottom-full mb-2 hidden group-hover:block z-50">
              <div className="bg-zinc-900 text-white text-[10px] py-1 px-2 rounded shadow-lg whitespace-nowrap">
                Add to Notes
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  </div>
);
