import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Loader2, ExternalLink } from 'lucide-react';
import { CONTENT_TYPE_ICONS } from '../../constants/contentTypeIcons';
import { Pagination } from './Pagination';
import { motion } from 'motion/react';
import { cn } from '../../utils/cn';
import { Course, Document } from '../../types';
import { VideoListItem } from '../../services/videoService';
import { documentService } from '../../services/documentService';
import { videoService } from '../../services/videoService';
import {
  getItemMeta, hashCode, DOODLES, PATTERNS,
  getVideoThumbnailSrc, getVideoFallbackThumbnail, getUploadedVideoPreviewSrc,
  type ModalState, type CardData, type QuestionData,
} from './pendingItemsHelpers';
import { PendingItemGenerationModal } from './PendingItemGenerationModal';

// ── public types ─────────────────────────────────────────────────────────────

export type PendingItem =
  | { kind: 'doc'; doc: Document }
  | { kind: 'video'; video: VideoListItem };

interface PendingItemsGridProps {
  items: PendingItem[];
  label: string;
  activeTab: 'flashcards' | 'quiz';
  ctaText: string;
  courses: Course[];
  countOverride?: number;
  onGenerated?: (item: PendingItem) => void;
}


// ── component ─────────────────────────────────────────────────────────────────

const PENDING_PAGE_SIZE = 10;

export const PendingItemsGrid: React.FC<PendingItemsGridProps> = ({
  items, label, activeTab, ctaText, courses, countOverride, onGenerated,
}) => {
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [page, setPage] = useState(1);
  const generatedItemRef = React.useRef<PendingItem | null>(null);

  // Reset to page 1 when items list changes length significantly
  React.useEffect(() => { setPage(1); }, [items.length]);

  const displayCount = countOverride ?? items.length;

  if (items.length === 0 && displayCount === 0) return null;

  const totalPages = Math.max(1, Math.ceil(items.length / PENDING_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = items.slice((safePage - 1) * PENDING_PAGE_SIZE, safePage * PENDING_PAGE_SIZE);

  const handleGenerate = async (e: React.MouseEvent, item: PendingItem) => {
    e.preventDefault();
    e.stopPropagation();
    const { id, name, to } = getItemMeta(item, courses);
    setGeneratingId(id);
    setErrorId(null);
    try {
      if (activeTab === 'flashcards') {
        let cards: CardData[];
        if (item.kind === 'video') {
          const raw = await videoService.generateFlashcards(item.video.id, item.video.videoUrl);
          cards = raw.map(c => ({ id: c.flashcardId, front: c.front, back: c.back }));
        } else {
          const raw = await documentService.generateFlashcards(item.doc.courseId || '', item.doc.id);
          cards = raw.map(c => ({ id: c.id, front: c.front, back: c.back }));
        }
        generatedItemRef.current = item;
        setModal({ kind: 'flashcards', name, detailTo: to, cards, idx: 0, isFlipped: false });
      } else {
        let questions: QuestionData[];
        if (item.kind === 'video') {
          const raw = await videoService.generateQuiz(item.video.id, item.video.videoUrl);
          questions = raw.map(q => ({ id: q.quizId, question: q.question, options: q.options, answer: q.correctAnswer, explanation: q.explanation }));
        } else {
          const raw = await documentService.generateQuiz(item.doc.courseId || '', item.doc.id);
          questions = raw.map(q => ({ id: q.id, question: q.question, options: q.options, answer: q.correctAnswer, explanation: q.explanation }));
        }
        generatedItemRef.current = item;
        setModal({ kind: 'quiz', name, detailTo: to, questions, item, phase: 'answering', currentQ: 0, selected: {} });
        return;
      }
    } catch {
      setErrorId(id);
      setTimeout(() => setErrorId(null), 3000);
    } finally {
      setGeneratingId(null);
    }
  };

  const closeModal = () => {
    const item = generatedItemRef.current;
    if (item) {
      onGenerated?.(item);
      generatedItemRef.current = null;
    }
    setModal(null);
  };


  return (
    <>
      {/* Section header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--border-color)]" />
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-text-muted">{label}</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500">{displayCount}</span>
          </div>
          <div className="h-px flex-1 bg-[var(--border-color)]" />
        </div>

        {items.length === 0 ? null : (
          <div className="flex flex-col divide-y divide-[var(--border-color)] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] overflow-hidden">
            {pagedItems.map((item, rowIdx) => {
              const { id, name, Icon, typeLabel, emoji, accentColor, courseName, to } = getItemMeta(item, courses);
              const hash = hashCode(id);
              const doodle = DOODLES[hash % DOODLES.length];
              const pattern = PATTERNS[hash % PATTERNS.length];
              const isGenerating = generatingId === id;
              const hasError = errorId === id;
              const videoThumbSrc = item.kind === 'video' ? getVideoThumbnailSrc(item.video) : '';
              const uploadedPreviewSrc = item.kind === 'video' ? getUploadedVideoPreviewSrc(item.video) : '';

              return (
                <motion.div
                  key={`${item.kind}-${id}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: rowIdx * 0.04, type: 'spring', stiffness: 340, damping: 28 }}
                  whileHover={{ x: 3, backgroundColor: 'var(--bg-sidebar)' }}
                  className="group relative flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-[var(--border-color)]/30"
                >
                  {/* Left accent line */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-r-full"
                    style={{ backgroundColor: accentColor }}
                  />

                  {/* Thumbnail / Icon */}
                  <div className="shrink-0">
                    {item.kind === 'video' ? (
                      <div className="relative w-14 h-10 rounded-lg overflow-hidden bg-zinc-100">
                        <div className="absolute inset-0 flex items-center justify-center text-zinc-300">
                          <CONTENT_TYPE_ICONS.video.icon size={14} />
                        </div>
                        {uploadedPreviewSrc && (
                          <video
                            src={`${uploadedPreviewSrc}#t=0.1`}
                            className="absolute inset-0 z-10 h-full w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        )}
                        {videoThumbSrc && (
                          <img
                            src={videoThumbSrc}
                            alt={item.video.title}
                            className="relative z-20 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                            onError={e => {
                              const img = e.target as HTMLImageElement;
                              const fallback = getVideoFallbackThumbnail(item.video);
                              if (fallback && img.dataset.fallbackUsed !== 'true') {
                                img.dataset.fallbackUsed = 'true';
                                img.src = fallback;
                              } else {
                                img.style.display = 'none';
                              }
                            }}
                          />
                        )}
                        <div className="absolute inset-0 z-30 bg-black/0 group-hover:bg-black/25 transition-colors duration-200 flex items-center justify-center">
                          <CONTENT_TYPE_ICONS.video.icon size={12} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                        </div>
                      </div>
                    ) : (
                      <div
                        className="relative w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center shrink-0"
                        style={{ backgroundColor: accentColor, backgroundImage: pattern }}
                      >
                        <span className="absolute -top-1 -right-1 text-xl opacity-20 select-none" aria-hidden>{doodle}</span>
                        <Icon size={16} className="text-white drop-shadow relative z-10" />
                      </div>
                    )}
                  </div>

                  {/* Text — clickable area */}
                  <Link
                    to={to}
                    state={{ activeTab }}
                    className="flex-1 min-w-0 flex flex-col gap-0.5"
                    onClick={e => { if (isGenerating) e.preventDefault(); }}
                  >
                    <p className="text-sm font-semibold text-text-main truncate leading-snug group-hover:text-primary transition-colors duration-150">{name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accentColor }}>
                        {emoji} {typeLabel}
                      </span>
                      {courseName ? (
                        <>
                          <span className="text-[10px] text-text-muted">·</span>
                          <span className="text-[10px] font-semibold text-text-muted truncate">{courseName}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] text-text-muted">·</span>
                          <span className="text-[10px] text-text-muted">Uncategorized</span>
                        </>
                      )}
                    </div>
                  </Link>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-2">
                    <Link
                      to={to}
                      state={{ activeTab }}
                      className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-text-muted hover:text-text-main transition-colors opacity-0 group-hover:opacity-100"
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink size={11} />
                      Open
                    </Link>

                    <button
                      onClick={e => handleGenerate(e, item)}
                      disabled={isGenerating}
                      className={cn(
                        'flex items-center gap-1 text-[10px] font-black uppercase tracking-wide rounded-lg px-2 py-1 transition-all duration-200',
                        hasError
                          ? 'text-red-500 cursor-not-allowed'
                          : isGenerating
                            ? 'text-text-muted opacity-70 cursor-not-allowed'
                            : 'hover:-translate-y-0.5 hover:shadow-sm active:scale-95',
                      )}
                      style={{
                        color: hasError ? undefined : accentColor,
                        ...((!hasError && !isGenerating) && { ['--hover-bg' as string]: accentColor + '18' }),
                      }}
                      onMouseEnter={e => { if (!hasError && !isGenerating) (e.currentTarget as HTMLElement).style.backgroundColor = accentColor + '18'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
                    >
                      {isGenerating
                        ? <><Loader2 size={9} className="animate-spin" /> Generating…</>
                        : hasError
                          ? 'Failed'
                          : <><Sparkles size={9} /> {ctaText}</>
                      }
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          label={`${(safePage - 1) * PENDING_PAGE_SIZE + 1}–${Math.min(safePage * PENDING_PAGE_SIZE, items.length)} of ${items.length}`}
          size="sm"
        />
      </div>

      <PendingItemGenerationModal modal={modal} setModal={setModal} onClose={closeModal} />
    </>
  );
};
