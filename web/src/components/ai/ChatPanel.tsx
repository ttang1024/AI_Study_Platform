import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Send, Sparkles, User, Copy, Plus, Check, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useStudy } from '../../context/StudyContext';
import { cn } from '../../utils/cn';

interface ExternalMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  isError?: boolean;
}

export interface ChatPanelRef {
  setInput: (text: string) => void;
  scrollToBottom: () => void;
}

interface ChatPanelProps {
  onTabChange?: (tab: 'summary' | 'mindmap' | 'notes' | 'flashcards' | 'quiz') => void;
  /** External messages (bypasses StudyContext when set) */
  externalMessages?: ExternalMessage[];
  /** External send handler (non-streaming) */
  onExternalSend?: (message: string) => Promise<void>;
  /** External streaming send handler — receives onChunk callback to deliver tokens */
  onExternalStreamSend?: (message: string, onChunk: (chunk: string) => void) => Promise<void>;
  /** External add-to-note handler (receives HTML string) */
  onExternalAddToNote?: (html: string) => void;
  /** Placeholder for the textarea */
  placeholder?: string;
  /** Hide the "AI Tutor" header bar (use when the parent already provides a header) */
  hideHeader?: boolean;
  /** Hide the add-to-notes action under model responses */
  hideAddToNotes?: boolean;
}

export const ChatPanel = forwardRef<ChatPanelRef, ChatPanelProps>(({
  onTabChange,
  externalMessages,
  onExternalSend,
  onExternalStreamSend,
  onExternalAddToNote,
  placeholder,
  hideHeader = false,
  hideAddToNotes = false,
}, ref) => {
  const { chatMessages: contextMessages, addChatMessage, aiInput, setAiInput, setNoteInput } = useStudy();
  const isExternal = onExternalSend !== undefined || onExternalStreamSend !== undefined;

  const [localInput, setLocalInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [localMessages, setLocalMessages] = useState<ExternalMessage[]>([]);
  const messages = isExternal ? (externalMessages ?? localMessages) : contextMessages;
  const input = isExternal ? localInput : aiInput;
  const setInput = isExternal ? setLocalInput : setAiInput;

  useImperativeHandle(ref, () => ({
    setInput: (text: string) => setInput(text),
    scrollToBottom: () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    },
  }), [setInput]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddToNotes = (content: string) => {
    const formattedContent = `<p>${content.replace(/\n/g, '</p><p>')}</p>`;
    if (onExternalAddToNote) {
      onExternalAddToNote(formattedContent);
    } else {
      setNoteInput(prev => {
        if (!prev || prev === '<p></p>') return formattedContent;
        return prev + formattedContent;
      });
    }
    if (onTabChange) {
      onTabChange('notes');
    }
  };

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || isLoading) return;
    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    try {
      if (onExternalStreamSend) {
        let accumulated = '';
        await onExternalStreamSend(msg, (chunk) => {
          accumulated += chunk;
          setStreamingContent(accumulated);
        });
        // streaming done — message is already persisted on the server;
        // externalMessages should refresh. If using localMessages fallback, add it.
        if (!externalMessages) {
          setLocalMessages(prev => [
            ...prev,
            { id: `u-${Date.now()}`, role: 'user', content: msg },
            { id: `m-${Date.now()}`, role: 'model', content: accumulated },
          ]);
        }
        setStreamingContent('');
      } else if (isExternal && onExternalSend) {
        await onExternalSend(msg);
      } else {
        await addChatMessage('user', msg);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setStreamingContent('');
      if (onExternalStreamSend && !externalMessages) {
        setLocalMessages(prev => [
          ...prev,
          { id: `u-${Date.now()}`, role: 'user', content: msg },
          { id: `e-${Date.now()}`, role: 'model', content: error instanceof Error ? error.message : 'An unknown error occurred.', isError: true },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[var(--bg-app)]">
      {!hideHeader && (
        <div className="flex items-center gap-2 border-b border-[var(--border-color)] px-4 py-3">
          <Sparkles size={18} className="text-[var(--primary)]" />
          <h3 className="font-semibold text-text-main">AI Tutor</h3>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center p-8">
            <div className="mb-4 rounded-full bg-[var(--primary)]/10 p-4 text-[var(--primary)]">
              <Sparkles size={32} />
            </div>
            <h4 className="mb-2 font-medium text-text-main">Ask your AI Tutor</h4>
            <p className="text-sm text-text-muted">
              Select text from the document to ask questions or type your query below.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
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
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-bold text-text-main">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
                      ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      code: ({ children, className }) => {
                        const isBlock = className?.includes('language-');
                        return isBlock
                          ? <code className="block my-2 rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100 overflow-x-auto whitespace-pre">{children}</code>
                          : <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs text-zinc-800 font-mono">{children}</code>;
                      },
                      pre: ({ children }) => <>{children}</>,
                      h1: ({ children }) => <h1 className="mb-1 text-base font-bold">{children}</h1>,
                      h2: ({ children }) => <h2 className="mb-1 text-sm font-bold">{children}</h2>,
                      h3: ({ children }) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
                      blockquote: ({ children }) => <blockquote className="border-l-2 border-[var(--primary)]/40 pl-3 italic text-text-muted">{children}</blockquote>,
                      table: ({ children }) => (
                        <div className="my-2 max-w-full overflow-x-auto rounded-lg border border-[var(--border-color)] bg-white">
                          <table className="min-w-full border-collapse text-left text-xs">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => <thead className="bg-zinc-100 text-text-main">{children}</thead>,
                      th: ({ children }) => <th className="border-b border-r border-[var(--border-color)] px-3 py-2 font-semibold last:border-r-0">{children}</th>,
                      td: ({ children }) => <td className="border-b border-r border-[var(--border-color)] px-3 py-2 align-top last:border-r-0">{children}</td>,
                      tr: ({ children }) => <tr className="last:[&_td]:border-b-0">{children}</tr>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
              <div className={cn(
                "flex items-center gap-2 px-1",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}>
                <button
                  onClick={() => handleCopy(msg.id, msg.content)}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 text-text-muted transition-all flex items-center justify-center border border-transparent hover:border-[var(--border-color)] group relative"
                  title={copiedId === msg.id ? 'Copied to clipboard' : 'Copy to clipboard'}
                >
                  {copiedId === msg.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block z-50">
                    <div className="bg-zinc-900 text-white text-[10px] py-1 px-2 rounded shadow-lg whitespace-nowrap">
                      {copiedId === msg.id ? 'Copied' : 'Copy'}
                    </div>
                  </div>
                </button>
                {msg.role === 'model' && !msg.isError && !hideAddToNotes && (
                  <button
                    onClick={() => handleAddToNotes(msg.content)}
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
        ))}
        {isLoading && streamingContent && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white">
              <Sparkles size={14} className="animate-pulse" />
            </div>
            <div className="rounded-[var(--radius)] rounded-tl-none bg-[var(--primary)]/10 px-4 py-2 text-sm leading-relaxed text-text-main border border-[var(--primary)]/20 max-w-[85%]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  strong: ({ children }) => <strong className="font-bold text-text-main">{children}</strong>,
                  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  table: ({ children }) => (
                    <div className="my-2 max-w-full overflow-x-auto rounded-lg border border-[var(--border-color)] bg-white">
                      <table className="min-w-full border-collapse text-left text-xs">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-zinc-100 text-text-main">{children}</thead>,
                  th: ({ children }) => <th className="border-b border-r border-[var(--border-color)] px-3 py-2 font-semibold last:border-r-0">{children}</th>,
                  td: ({ children }) => <td className="border-b border-r border-[var(--border-color)] px-3 py-2 align-top last:border-r-0">{children}</td>,
                  tr: ({ children }) => <tr className="last:[&_td]:border-b-0">{children}</tr>,
                }}
              >
                {streamingContent}
              </ReactMarkdown>
              <span className="inline-block h-3.5 w-0.5 animate-pulse bg-[var(--primary)] ml-0.5 align-middle" />
            </div>
          </div>
        )}
        {isLoading && !streamingContent && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white">
              <Sparkles size={14} className="animate-pulse" />
            </div>
            <div className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)]/10 px-4 py-2 border border-[var(--primary)]/20">
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)]" />
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)] [animation-delay:0.2s]" />
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)] [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border-color)] p-4">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={placeholder ?? "Ask anything about the document..."}
            className="w-full resize-none rounded-[var(--radius)] border border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-3 pr-12 text-sm text-text-main outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all placeholder:text-text-muted"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute bottom-3 right-3 rounded-[var(--radius)] bg-[var(--primary)] p-1.5 text-white hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
});
