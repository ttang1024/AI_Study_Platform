import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Send, Sparkles, User, Copy, Plus, Check, AlertCircle, Mic, MicOff, Volume2, VolumeX, Square, Loader2, Paperclip, X, FileText, ExternalLink } from 'lucide-react';
import type { ChatAttachment, ChatMessageAttachment } from '../../services/aiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useStudy } from '../../context/StudyContext';
import { useDictation } from '../tutor/useDictation';
import { synthesizeSpeech } from '../../services/edgeTtsService';
import { markdownToPlainText } from './ChatMarkdown';
import { cn } from '../../utils/cn';

interface ExternalMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  isError?: boolean;
  attachments?: ChatMessageAttachment[];
}

/** A staged attachment held in the composer before the message is sent. */
interface PendingAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  /** Raw base64 (no data: URL prefix), ready to send to the API. */
  data: string;
  /** Object URL used for the inline image thumbnail (images only). */
  previewUrl?: string;
  isImage: boolean;
}

const MAX_ATTACHMENTS = 8;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB
const ATTACHMENT_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,application/pdf';

/** Read a file into raw base64, stripping the `data:<mime>;base64,` prefix. */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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
  onExternalStreamSend?: (message: string, onChunk: (chunk: string) => void, attachments?: ChatAttachment[]) => Promise<void>;
  /** Enable image/PDF attachment uploads (paperclip, paste, drag-and-drop). Requires onExternalStreamSend. */
  enableAttachments?: boolean;
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
  enableAttachments = false,
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

  // ── Voice: speech input (dictation) + spoken replies (TTS) ──
  const { listening, toggle: toggleListening, supported: dictationSupported } = useDictation(text => setInput(text));
  const [speakReplies, setSpeakReplies] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stop any in-flight speech when the panel unmounts.
  useEffect(() => () => audioRef.current?.pause(), []);

  // ── Attachments: images + PDFs (paperclip / paste / drag-and-drop) ──
  const attachmentsEnabled = enableAttachments && onExternalStreamSend !== undefined;
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  // An already-sent attachment opened in the full-screen preview (image lightbox / PDF viewer).
  const [previewAttachment, setPreviewAttachment] = useState<ChatMessageAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<PendingAttachment[]>([]);
  useEffect(() => { attachmentsRef.current = attachments; }, [attachments]);
  // Release image preview object URLs when the panel unmounts.
  useEffect(() => () => attachmentsRef.current.forEach(a => a.previewUrl && URL.revokeObjectURL(a.previewUrl)), []);

  // Close the full-screen attachment preview on Escape.
  useEffect(() => {
    if (!previewAttachment) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreviewAttachment(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewAttachment]);

  const handleFiles = async (files: File[]) => {
    const accepted = files.filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
    for (const file of accepted) {
      if (file.size > MAX_ATTACHMENT_BYTES) continue;
      let data: string;
      try { data = await readFileAsBase64(file); } catch { continue; }
      const isImage = file.type.startsWith('image/');
      setAttachments(prev => {
        if (prev.length >= MAX_ATTACHMENTS) return prev;
        return [...prev, {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fileName: file.name,
          mimeType: file.type === 'image/jpg' ? 'image/jpeg' : file.type,
          data,
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
          isImage,
        }];
      });
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const target = prev.find(a => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(a => a.id !== id);
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!attachmentsEnabled) return;
    const files = Array.from(e.clipboardData.files);
    if (files.length > 0) {
      e.preventDefault();
      void handleFiles(files);
    }
  };

  const stopSpeaking = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeakingId(null);
  };

  // Read a model reply aloud. Passing the same id again toggles playback off.
  const speak = async (id: string, content: string) => {
    if (speakingId === id) { stopSpeaking(); return; }
    audioRef.current?.pause();
    setSpeakingId(id);
    try {
      const urls = await synthesizeSpeech(markdownToPlainText(content));
      const playNext = (i: number) => {
        if (i >= urls.length) { setSpeakingId(null); return; }
        const audio = new Audio(urls[i]);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(urls[i]); playNext(i + 1); };
        void audio.play();
      };
      playNext(0);
    } catch {
      setSpeakingId(null);
    }
  };

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
    const outgoing: ChatAttachment[] = attachments.map(a => ({ mimeType: a.mimeType, data: a.data, fileName: a.fileName }));
    if ((!msg && outgoing.length === 0) || isLoading) return;
    if (listening) toggleListening();
    setInput('');
    // Release preview URLs and clear the composer's staged attachments.
    attachments.forEach(a => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
    setAttachments([]);
    setIsLoading(true);
    setStreamingContent('');

    // Inline thumbnails for the locally-rendered user message (local-fallback path only).
    const userAttachments: ChatMessageAttachment[] | undefined = outgoing.length
      ? outgoing.map(a => ({ url: `data:${a.mimeType};base64,${a.data}`, mimeType: a.mimeType, fileName: a.fileName }))
      : undefined;

    try {
      if (onExternalStreamSend) {
        let accumulated = '';
        await onExternalStreamSend(msg, (chunk) => {
          accumulated += chunk;
          setStreamingContent(accumulated);
        }, outgoing.length ? outgoing : undefined);
        // streaming done — message is already persisted on the server;
        // externalMessages should refresh. If using localMessages fallback, add it.
        const replyId = `m-${Date.now()}`;
        if (!externalMessages) {
          setLocalMessages(prev => [
            ...prev,
            { id: `u-${Date.now()}`, role: 'user', content: msg, attachments: userAttachments },
            { id: replyId, role: 'model', content: accumulated },
          ]);
        }
        setStreamingContent('');
        if (speakReplies && accumulated) void speak(replyId, accumulated);
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
          { id: `u-${Date.now()}`, role: 'user', content: msg, attachments: userAttachments },
          { id: `e-${Date.now()}`, role: 'model', content: error instanceof Error ? error.message : 'An unknown error occurred.', isError: true },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative flex h-full flex-col bg-[var(--bg-app)]"
      onDragOver={attachmentsEnabled ? (e) => { e.preventDefault(); setIsDragging(true); } : undefined}
      onDragLeave={attachmentsEnabled ? (e) => { if (e.currentTarget === e.target) setIsDragging(false); } : undefined}
      onDrop={attachmentsEnabled ? (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) void handleFiles(files);
      } : undefined}
    >
      {attachmentsEnabled && isDragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--primary)]/10 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-2 rounded-[var(--radius)] border-2 border-dashed border-[var(--primary)] bg-[var(--bg-app)] px-8 py-6 text-[var(--primary)]">
            <Paperclip size={28} />
            <p className="text-sm font-medium">Drop images or PDFs to attach</p>
          </div>
        </div>
      )}
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
                  <>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-1.5 last:mb-0">
                        {msg.attachments.map((att, i) => (
                          att.mimeType.startsWith('image/') ? (
                            <button key={i} type="button" onClick={() => setPreviewAttachment(att)} title={att.fileName ?? 'attachment'} className="block">
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
                              onClick={() => setPreviewAttachment(att)}
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
                {msg.role === 'model' && !msg.isError && (
                  <button
                    onClick={() => speak(msg.id, msg.content)}
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
        {attachmentsEnabled && attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map(att => (
              <div
                key={att.id}
                className="group relative flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-1.5 pr-2"
              >
                {att.isImage && att.previewUrl ? (
                  <img src={att.previewUrl} alt={att.fileName} className="h-10 w-10 rounded object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-[var(--primary)]/10 text-[var(--primary)]">
                    <FileText size={18} />
                  </div>
                )}
                <span className="max-w-[120px] truncate text-xs text-text-main" title={att.fileName}>{att.fileName}</span>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-700 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-900"
                  title="Remove attachment"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="relative">
          {attachmentsEnabled && (
            <input
              ref={fileInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                if (files.length > 0) void handleFiles(files);
                e.target.value = '';
              }}
            />
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={listening ? 'Listening…' : (placeholder ?? "Ask anything about the document...")}
            className={cn(
              "w-full resize-none rounded-[var(--radius)] border border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-3 text-sm text-text-main outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all placeholder:text-text-muted",
              attachmentsEnabled ? "pr-36" : "pr-28",
            )}
            rows={2}
          />
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
            {attachmentsEnabled && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={attachments.length >= MAX_ATTACHMENTS}
                title={attachments.length >= MAX_ATTACHMENTS ? `Up to ${MAX_ATTACHMENTS} attachments` : 'Attach images or PDFs'}
                className="rounded-[var(--radius)] border border-[var(--border-color)] bg-[var(--bg-app)] p-1.5 text-text-muted transition-colors hover:text-text-main disabled:opacity-50"
              >
                <Paperclip size={16} />
              </button>
            )}
            <button
              onClick={() => { setSpeakReplies(v => !v); if (speakReplies) stopSpeaking(); }}
              title={speakReplies ? 'Auto-read replies aloud: on' : 'Auto-read replies aloud: off'}
              className={cn(
                'rounded-[var(--radius)] p-1.5 transition-colors border',
                speakReplies
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-app)] text-text-muted hover:text-text-main',
              )}
            >
              {speakReplies ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            {dictationSupported && (
              <button
                onClick={toggleListening}
                title={listening ? 'Stop listening' : 'Speak'}
                className={cn(
                  'rounded-[var(--radius)] p-1.5 transition-colors border',
                  listening
                    ? 'border-red-300 bg-red-50 text-red-500 animate-pulse'
                    : 'border-[var(--border-color)] bg-[var(--bg-app)] text-text-muted hover:text-text-main',
                )}
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={(!input.trim() && attachments.length === 0) || isLoading}
              className="rounded-[var(--radius)] bg-[var(--primary)] p-1.5 text-white hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>

      {previewAttachment && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 sm:p-8"
          onClick={() => setPreviewAttachment(null)}
        >
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <a
              href={previewAttachment.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open in new tab"
              className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            >
              <ExternalLink size={20} />
            </a>
            <button
              onClick={() => setPreviewAttachment(null)}
              title="Close (Esc)"
              className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            >
              <X size={20} />
            </button>
          </div>
          {previewAttachment.mimeType.startsWith('image/') ? (
            <img
              src={previewAttachment.url}
              alt={previewAttachment.fileName ?? 'attachment'}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />
          ) : (
            <iframe
              src={previewAttachment.url}
              title={previewAttachment.fileName ?? 'attachment'}
              onClick={(e) => e.stopPropagation()}
              className="h-[90vh] w-full max-w-4xl rounded-lg bg-white shadow-2xl"
            />
          )}
        </div>,
        document.body,
      )}
    </div>
  );
});
