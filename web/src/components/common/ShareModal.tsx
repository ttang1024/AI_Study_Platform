import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Share2, Copy, Check, Loader2, ExternalLink, FileText, Map, BookOpen, BrainCircuit, MessageSquare } from 'lucide-react';
import { createShare, ShareableQuiz, ShareableCard } from '../../services/shareContentService';
import { cn } from '../../utils/cn';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  summary?: string | null;
  mindMapText?: string | null;
  notesHtml?: string | null;
  fetchQuizzes?: () => Promise<ShareableQuiz[]>;
  fetchFlashcards?: () => Promise<ShareableCard[]>;
  sourceType?: 'youtube' | 'article' | 'audio' | 'podcast' | 'document' | null;
  sourceUrl?: string | null;
  originalArticleUrl?: string | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  open, onClose, title,
  summary, mindMapText, notesHtml,
  fetchQuizzes, fetchFlashcards,
  sourceType, sourceUrl, originalArticleUrl,
}) => {
  const [selected, setSelected] = useState({
    summary: !!summary,
    mindMap: !!mindMapText,
    notes: !!notesHtml,
    quizzes: false,
    flashcards: false,
  });
  const [step, setStep] = useState<'select' | 'generating' | 'done'>('select');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: keyof typeof selected) => {
    setSelected(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = useCallback(async () => {
    setStep('generating');
    setError(null);
    try {
      let quizzes: ShareableQuiz[] | null = null;
      let flashcards: ShareableCard[] | null = null;

      if (selected.quizzes && fetchQuizzes) {
        quizzes = await fetchQuizzes();
      }
      if (selected.flashcards && fetchFlashcards) {
        flashcards = await fetchFlashcards();
      }

      const result = await createShare({
        title,
        summary: selected.summary ? summary : null,
        mindMapText: selected.mindMap ? mindMapText : null,
        notesHtml: selected.notes ? notesHtml : null,
        quizzes,
        flashcards,
        sourceType,
        sourceUrl,
        originalArticleUrl,
      });

      setShareUrl(result.shareUrl);
      setStep('done');
    } catch {
      setError('Failed to generate share link. Please try again.');
      setStep('select');
    }
  }, [selected, title, summary, mindMapText, notesHtml, fetchQuizzes, fetchFlashcards, sourceType, sourceUrl, originalArticleUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setStep('select');
    setShareUrl('');
    setCopied(false);
    setError(null);
    setSelected({
      summary: !!summary,
      mindMap: !!mindMapText,
      notes: !!notesHtml,
      quizzes: false,
      flashcards: false,
    });
    onClose();
  };

  const items = [
    { key: 'summary' as const, label: 'Summary', icon: FileText, available: !!summary },
    { key: 'mindMap' as const, label: 'Mind Map', icon: Map, available: !!mindMapText },
    { key: 'notes' as const, label: 'Notes', icon: MessageSquare, available: !!notesHtml },
    { key: 'flashcards' as const, label: 'Flashcards', icon: BrainCircuit, available: !!fetchFlashcards },
    { key: 'quizzes' as const, label: 'Quiz', icon: BookOpen, available: !!fetchQuizzes },
  ].filter(i => i.available);

  const hasSelection = Object.values(selected).some(Boolean);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            className="relative w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Share2 size={16} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-text-main">Share</h2>
                  <p className="text-xs text-text-muted truncate max-w-[220px]">{title}</p>
                </div>
              </div>
              <button onClick={handleClose} className="rounded-lg p-1.5 text-text-muted hover:bg-zinc-100 hover:text-text-main transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {step === 'done' ? (
                /* Done state */
                <div className="space-y-4">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                      <Check size={20} className="text-emerald-600" />
                    </div>
                    <p className="text-sm font-semibold text-emerald-800">Share link created!</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Anyone with the link can view this content.</p>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-zinc-50 px-3 py-2.5">
                    <span className="flex-1 text-xs text-text-main truncate font-mono">{shareUrl}</span>
                    <button
                      onClick={handleCopy}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shrink-0',
                        copied ? 'bg-emerald-100 text-emerald-700' : 'bg-primary text-white hover:opacity-90'
                      )}
                    >
                      {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>

                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full rounded-xl border border-[var(--border-color)] py-2.5 text-sm font-medium text-text-muted hover:text-primary hover:border-primary/30 transition-all"
                  >
                    <ExternalLink size={14} />
                    Open shared page
                  </a>
                </div>
              ) : (
                /* Select state */
                <>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">
                      Select content to include
                    </p>
                    <div className="space-y-2">
                      {items.map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          onClick={() => toggle(key)}
                          className={cn(
                            'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all',
                            selected[key]
                              ? 'border-primary/40 bg-primary/5 text-primary'
                              : 'border-[var(--border-color)] text-text-muted hover:border-primary/20 hover:text-text-main'
                          )}
                        >
                          <div className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                            selected[key] ? 'bg-primary/10' : 'bg-zinc-100'
                          )}>
                            <Icon size={14} className={selected[key] ? 'text-primary' : 'text-zinc-400'} />
                          </div>
                          <span className="flex-1 text-left">{label}</span>
                          <div className={cn(
                            'w-4 h-4 rounded-full border-2 transition-all',
                            selected[key] ? 'border-primary bg-primary' : 'border-zinc-300'
                          )}>
                            {selected[key] && <Check size={10} className="text-white m-auto mt-0.5" />}
                          </div>
                        </button>
                      ))}
                    </div>
                    {items.length === 0 && (
                      <p className="text-sm text-text-muted text-center py-4">
                        No content available to share yet. Generate a summary or mind map first.
                      </p>
                    )}
                  </div>

                  {error && (
                    <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <button
                    onClick={handleGenerate}
                    disabled={!hasSelection || step === 'generating' || items.length === 0}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all',
                      hasSelection && items.length > 0
                        ? 'bg-primary text-white hover:opacity-90'
                        : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                    )}
                  >
                    {step === 'generating' ? (
                      <><Loader2 size={16} className="animate-spin" /> Generating link…</>
                    ) : (
                      <><Share2 size={16} /> Generate Share Link</>
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
