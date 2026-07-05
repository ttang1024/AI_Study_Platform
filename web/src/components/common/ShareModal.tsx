import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Share2, Copy, Check, Loader2, ExternalLink, Image as ImageIcon, Download } from 'lucide-react';
import { STUDY_TYPE_ICONS } from '../../constants/contentTypeIcons';
import { createShare, ShareableQuiz, ShareableCard } from '../../services/shareContentService';
import { ShareImageCard, ShareImageContent } from './ShareImageCard';
import { cn } from '../../utils/cn';
import type { VideoSourceType } from '../../constants/videoSources';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  summary?: string | null;
  mindMapText?: string | null;
  notesHtml?: string | null;
  fetchQuizzes?: () => Promise<ShareableQuiz[]>;
  fetchFlashcards?: () => Promise<ShareableCard[]>;
  sourceType?: VideoSourceType | 'article' | 'audio' | 'podcast' | 'document' | null;
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
  const [step, setStep] = useState<'select' | 'generating' | 'done' | 'imaging' | 'image'>('select');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [imageContent, setImageContent] = useState<ShareImageContent | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const toggle = (key: keyof typeof selected) => {
    setSelected(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Collects the currently selected content, resolving lazily-fetched
  // quizzes/flashcards, into a single payload usable for both link and image.
  const collectContent = useCallback(async (): Promise<ShareImageContent> => {
    let quizzes: ShareableQuiz[] | null = null;
    let flashcards: ShareableCard[] | null = null;
    if (selected.quizzes && fetchQuizzes) quizzes = await fetchQuizzes();
    if (selected.flashcards && fetchFlashcards) flashcards = await fetchFlashcards();
    return {
      title,
      summary: selected.summary ? summary : null,
      mindMapText: selected.mindMap ? mindMapText : null,
      notesHtml: selected.notes ? notesHtml : null,
      quizzes,
      flashcards,
    };
  }, [selected, title, summary, mindMapText, notesHtml, fetchQuizzes, fetchFlashcards]);

  const handleGenerate = useCallback(async () => {
    setStep('generating');
    setError(null);
    try {
      const content = await collectContent();

      const result = await createShare({
        ...content,
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
  }, [collectContent, sourceType, sourceUrl, originalArticleUrl]);

  const handleGenerateImage = useCallback(async () => {
    setStep('imaging');
    setError(null);
    try {
      const content = await collectContent();
      setImageContent(content);
      // Wait for the off-screen card to mount and lay out before capturing.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const el = cardRef.current;
      if (!el) throw new Error('card not ready');
      // Render at a higher pixel density so the image stays sharp when enlarged
      // (especially the fine mind-map text/lines). Cap the resulting bitmap so a
      // very tall/wide card stays within the browser's canvas size limits.
      const rect = el.getBoundingClientRect();
      const MAX_SIDE = 8000;
      const pixelRatio = Math.max(2, Math.min(3, MAX_SIDE / Math.max(rect.width, rect.height, 1)));
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(el, { backgroundColor: '#ffffff', pixelRatio, cacheBust: true });
      setImageDataUrl(dataUrl);
      setStep('image');
    } catch {
      setError('Failed to generate image. Please try again.');
      setStep('select');
    }
  }, [collectContent]);

  const safeFileName = title.replace(/[^\w一-龥-]+/g, '_').slice(0, 60) || 'share';

  const handleDownloadImage = () => {
    const a = document.createElement('a');
    a.href = imageDataUrl;
    a.download = `${safeFileName}.png`;
    a.click();
  };

  const handleCopyImage = useCallback(async () => {
    try {
      const blob = await (await fetch(imageDataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy not supported in this browser. Use Download instead.');
    }
  }, [imageDataUrl]);

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
    setImageDataUrl('');
    setImageContent(null);
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
    { key: 'summary' as const,   label: 'Summary',    icon: STUDY_TYPE_ICONS.summary.icon,   available: !!summary      },
    { key: 'mindMap' as const,   label: 'Mind Map',   icon: STUDY_TYPE_ICONS.mindmap.icon,   available: !!mindMapText  },
    { key: 'notes' as const,     label: 'Notes',      icon: STUDY_TYPE_ICONS.notes.icon,     available: !!notesHtml    },
    { key: 'flashcards' as const,label: 'Flashcards', icon: STUDY_TYPE_ICONS.flashcard.icon, available: !!fetchFlashcards },
    { key: 'quizzes' as const,   label: 'Quiz',       icon: STUDY_TYPE_ICONS.quiz.icon,      available: !!fetchQuizzes },
  ].filter(i => i.available);

  const hasSelection = Object.values(selected).some(Boolean);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Off-screen render target captured for "Save as Image". */}
          {imageContent && (
            <div style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }} aria-hidden>
              <ShareImageCard ref={cardRef} content={imageContent} />
            </div>
          )}
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
              ) : step === 'image' ? (
                /* Image preview state */
                <div className="space-y-4">
                  <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-[var(--border-color)] bg-zinc-50 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageDataUrl} alt={title} className="w-full rounded-lg shadow-sm" />
                  </div>

                  {error && (
                    <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={handleDownloadImage}
                      className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white hover:opacity-90 transition-all"
                    >
                      <Download size={16} /> Download
                    </button>
                    <button
                      onClick={handleCopyImage}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold transition-all',
                        copied
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-primary/40 text-primary hover:bg-primary/5'
                      )}
                    >
                      {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy Image</>}
                    </button>
                  </div>

                  <button
                    onClick={() => { setStep('select'); setImageDataUrl(''); setError(null); }}
                    className="w-full text-xs font-medium text-text-muted hover:text-primary transition-colors"
                  >
                    ← Back to options
                  </button>
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

                  {(() => {
                    const busy = step === 'generating' || step === 'imaging';
                    const enabled = hasSelection && items.length > 0 && !busy;
                    return (
                      <div className="space-y-2.5">
                        <button
                          onClick={handleGenerate}
                          disabled={!enabled}
                          className={cn(
                            'w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all',
                            enabled ? 'bg-primary text-white hover:opacity-90' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                          )}
                        >
                          {step === 'generating' ? (
                            <><Loader2 size={16} className="animate-spin" /> Generating link…</>
                          ) : (
                            <><Share2 size={16} /> Generate Share Link</>
                          )}
                        </button>
                        <button
                          onClick={handleGenerateImage}
                          disabled={!enabled}
                          className={cn(
                            'w-full flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold transition-all',
                            enabled
                              ? 'border-primary/40 text-primary hover:bg-primary/5'
                              : 'border-[var(--border-color)] text-zinc-400 cursor-not-allowed'
                          )}
                        >
                          {step === 'imaging' ? (
                            <><Loader2 size={16} className="animate-spin" /> Rendering image…</>
                          ) : (
                            <><ImageIcon size={16} /> Save as Image</>
                          )}
                        </button>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
