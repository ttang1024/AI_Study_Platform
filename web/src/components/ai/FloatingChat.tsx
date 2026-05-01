import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, User, Copy, Check, MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { aiService } from '../../services/aiService';
import { cn } from '../../utils/cn';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

export const FloatingChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [buttonY, setButtonY] = useState(() => window.innerHeight / 2);
  const dragging = useRef(false);
  const dragOffsetY = useRef(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragging.current = false;
    dragOffsetY.current = e.clientY - buttonY;
    buttonRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!buttonRef.current?.hasPointerCapture(e.pointerId)) return;
    dragging.current = true;
    const buttonH = buttonRef.current?.offsetHeight ?? 60;
    const newY = Math.min(
      Math.max(e.clientY - dragOffsetY.current, buttonH / 2),
      window.innerHeight - buttonH / 2
    );
    setButtonY(newY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) {
      setIsOpen(v => !v);
    }
    dragging.current = false;
  };

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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userText = input.trim();
    setInput('');

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: userText };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setStreamingContent('');

    try {
      const history = messages.map(m => ({ role: m.role, parts: [{ text: m.content }] }));
      let accumulated = '';
      await aiService.streamChat(history, userText, (chunk) => {
        accumulated += chunk;
        setStreamingContent(accumulated);
      });
      setStreamingContent('');
      setMessages(prev => [...prev, { id: `m-${Date.now()}`, role: 'model', content: accumulated }]);
    } catch {
      setStreamingContent('');
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'model', content: "I'm sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        ref={buttonRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ top: buttonY, transform: 'translateY(-50%)' }}
        className={cn(
          'fixed right-0 z-40 flex flex-col items-center justify-center gap-1.5 rounded-l-2xl px-2 py-4 shadow-xl transition-colors duration-300 cursor-grab active:cursor-grabbing select-none',
          isOpen
            ? 'bg-zinc-800 text-white'
            : 'bg-[var(--primary)] text-white hover:pr-3'
        )}
        title="AI Tutor"
      >
        <MessageCircle size={20} />
        <span className="text-[10px] font-bold uppercase tracking-wide [writing-mode:vertical-lr] rotate-180">
          AI Chat
        </span>
      </button>

      {/* Slide-in panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-[360px] max-w-[90vw] flex flex-col bg-[var(--bg-app)] border-l border-[var(--border-color)] shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3 bg-[var(--bg-sidebar)]">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-[var(--primary)]/10 p-1.5 text-[var(--primary)]">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-main text-sm">AI Study Tutor</h3>
                    <p className="text-[10px] text-text-muted">Ask anything about your studies</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-text-muted hover:bg-zinc-100 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center text-center p-8">
                    <div className="mb-4 rounded-full bg-[var(--primary)]/10 p-4 text-[var(--primary)]">
                      <Sparkles size={28} />
                    </div>
                    <h4 className="mb-2 font-medium text-text-main">AI Study Tutor</h4>
                    <p className="text-sm text-text-muted">Ask me anything about your studies or coursework.</p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                    <div className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs',
                      msg.role === 'user'
                        ? 'bg-[var(--bg-sidebar)] text-text-muted border border-[var(--border-color)]'
                        : 'bg-[var(--primary)] text-white'
                    )}>
                      {msg.role === 'user' ? <User size={12} /> : <Sparkles size={12} />}
                    </div>
                    <div className="flex flex-col gap-1 max-w-[85%]">
                      <div className={cn(
                        'rounded-2xl px-3 py-2 text-sm leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-[var(--bg-sidebar)] text-text-main border border-[var(--border-color)] rounded-tr-none'
                          : 'bg-[var(--primary)]/10 text-text-main border border-[var(--primary)]/20 rounded-tl-none'
                      )}>
                        {msg.role === 'model' ? (
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                              ul: ({ children }) => <ul className="mb-1 ml-4 list-disc">{children}</ul>,
                              li: ({ children }) => <li>{children}</li>,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        ) : msg.content}
                      </div>
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="self-start p-1 rounded text-text-muted hover:text-text-main transition-colors"
                      >
                        {copiedId === msg.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                ))}

                {isLoading && streamingContent && (
                  <div className="flex gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white">
                      <Sparkles size={12} className="animate-pulse" />
                    </div>
                    <div className="rounded-2xl rounded-tl-none bg-[var(--primary)]/10 px-3 py-2 text-sm leading-relaxed text-text-main border border-[var(--primary)]/20 max-w-[85%]">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                          ul: ({ children }) => <ul className="mb-1 ml-4 list-disc">{children}</ul>,
                          li: ({ children }) => <li>{children}</li>,
                        }}
                      >
                        {streamingContent}
                      </ReactMarkdown>
                      <span className="inline-block h-3 w-0.5 animate-pulse bg-[var(--primary)] ml-0.5 align-middle" />
                    </div>
                  </div>
                )}
                {isLoading && !streamingContent && (
                  <div className="flex gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white">
                      <Sparkles size={12} className="animate-pulse" />
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl bg-[var(--primary)]/10 px-3 py-2 border border-[var(--primary)]/20">
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)]" />
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)] [animation-delay:0.2s]" />
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)] [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-[var(--border-color)] p-3">
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
                    placeholder="Ask anything..."
                    className="w-full resize-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-2 pr-10 text-sm text-text-main outline-none focus:border-[var(--primary)] transition-all placeholder:text-text-muted"
                    rows={2}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="absolute bottom-2 right-2 rounded-lg bg-[var(--primary)] p-1.5 text-white hover:opacity-90 disabled:opacity-50 transition-colors"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
