import React, { useState, useRef, useEffect, useImperativeHandle, useCallback, forwardRef } from 'react';
import { Send, Sparkles, Mic, MicOff, Volume2, VolumeX, Loader2, Paperclip, X, FileText, Camera } from 'lucide-react';
import type { ChatAttachment, ChatMessageAttachment } from '../../services/aiService';
import 'katex/dist/katex.min.css';
import { useStudySession } from '../../context/StudySessionContext';
import { useDictation } from '../tutor/useDictation';
import { cn } from '../../utils/cn';
import type { ChatPanelMessage } from './chatTypes';
import { ChatBubbleMarkdown } from './ChatBubbleMarkdown';
import { ChatMessageRow } from './ChatMessageRow';
import { AttachmentLightbox } from './AttachmentLightbox';
import { useChatAttachments, MAX_ATTACHMENTS, ATTACHMENT_ACCEPT } from './useChatAttachments';
import { useSpeakReplies } from './useSpeakReplies';

export interface ChatPanelRef {
  setInput: (text: string) => void;
  scrollToBottom: () => void;
}

interface ChatPanelProps {
  onTabChange?: (tab: 'summary' | 'mindmap' | 'notes' | 'flashcards' | 'quiz') => void;
  /** External messages (bypasses StudyContext when set) */
  externalMessages?: ChatPanelMessage[];
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
  // Session-slice subscription only: core StudyContext updates (library,
  // stats, courses) no longer re-render the chat panel.
  const { chatMessages: contextMessages, addChatMessage, aiInput, setAiInput, setNoteInput } = useStudySession();
  const isExternal = onExternalSend !== undefined || onExternalStreamSend !== undefined;

  const [localInput, setLocalInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [localMessages, setLocalMessages] = useState<ChatPanelMessage[]>([]);
  const messages = isExternal ? (externalMessages ?? localMessages) : contextMessages;
  const input = isExternal ? localInput : aiInput;
  const setInput = isExternal ? setLocalInput : setAiInput;

  // ── Voice: speech input (dictation) + spoken replies (TTS) ──
  const { listening, toggle: toggleListening, supported: dictationSupported } = useDictation(text => setInput(text));
  const { speakReplies, setSpeakReplies, speakingId, speak, stopSpeaking } = useSpeakReplies();

  // ── Attachments: images + PDFs (paperclip / paste / drag-and-drop) ──
  const attachmentsEnabled = enableAttachments && onExternalStreamSend !== undefined;
  const {
    attachments, isDragging, setIsDragging, handleFiles, removeAttachment, clearAttachments, handlePaste,
  } = useChatAttachments(attachmentsEnabled);
  // An already-sent attachment opened in the full-screen preview (image lightbox / PDF viewer).
  const [previewAttachment, setPreviewAttachment] = useState<ChatMessageAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Photo problem capture: on phones this opens the camera directly, so a
  // textbook/handwritten problem can be snapped and asked about in one step.
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

  // Hands-free voice loop, part 2: when auto-read is on and the mic closes
  // (silence timeout or tap), send the dictated text without touching the
  // keyboard. Part 1 — reopening the mic after the reply is read — lives in
  // handleSend below.
  const prevListeningRef = useRef(false);
  useEffect(() => {
    if (prevListeningRef.current && !listening && speakReplies && input.trim() && !isLoading) {
      void handleSend();
    }
    prevListeningRef.current = listening;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  // Stable identities so React.memo on ChatMessageRow actually skips re-renders while composing.
  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleAddToNotes = useCallback((content: string) => {
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
  }, [onExternalAddToNote, onTabChange, setNoteInput]);

  const handleSend = async () => {
    const msg = input.trim();
    const outgoing: ChatAttachment[] = attachments.map(a => ({ mimeType: a.mimeType, data: a.data, fileName: a.fileName }));
    if ((!msg && outgoing.length === 0) || isLoading) return;
    if (listening) toggleListening();
    setInput('');
    clearAttachments();
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
        if (speakReplies && accumulated) {
          // Hands-free loop: when both voice toggles are on, reopen the mic
          // after the spoken reply finishes so the user can answer back.
          void speak(replyId, accumulated, () => {
            if (dictationSupported && !listening) toggleListening();
          });
        }
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
          <ChatMessageRow
            key={msg.id}
            msg={msg}
            copied={copiedId === msg.id}
            onCopy={handleCopy}
            speakingId={speakingId}
            onSpeak={speak}
            showAddToNotes={!hideAddToNotes}
            onAddToNotes={handleAddToNotes}
            onPreviewAttachment={setPreviewAttachment}
          />
        ))}
        {isLoading && streamingContent && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white">
              <Sparkles size={14} className="animate-pulse" />
            </div>
            <div className="rounded-[var(--radius)] rounded-tl-none bg-[var(--primary)]/10 px-4 py-2 text-sm leading-relaxed text-text-main border border-[var(--primary)]/20 max-w-[85%]">
              <ChatBubbleMarkdown>{streamingContent}</ChatBubbleMarkdown>
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
            <>
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
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  if (files.length > 0) void handleFiles(files);
                  e.target.value = '';
                }}
              />
            </>
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
                onClick={() => cameraInputRef.current?.click()}
                disabled={attachments.length >= MAX_ATTACHMENTS}
                title="Snap a photo of a problem"
                className="sm:hidden rounded-[var(--radius)] border border-[var(--border-color)] bg-[var(--bg-app)] p-1.5 text-text-muted transition-colors hover:text-text-main disabled:opacity-50"
              >
                <Camera size={16} />
              </button>
            )}
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

      {previewAttachment && (
        <AttachmentLightbox attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
      )}
    </div>
  );
});
