import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Youtube, Mic, Globe, Sparkles, Loader2, X, ChevronLeft, ChevronRight, ExternalLink, CheckCircle2, XCircle, Trophy } from 'lucide-react';
import { Pagination } from './Pagination';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../utils/cn';
import { getDocDisplayName } from '../../utils/docName';
import { Course, Document } from '../../types';
import { VideoListItem } from '../../services/youtubeService';
import { documentService } from '../../services/documentService';
import { youtubeService } from '../../services/youtubeService';

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

// ── internal types ────────────────────────────────────────────────────────────

type CardData = { id: string; front: string; back: string };
type QuestionData = { id: string; question: string; options?: string[]; answer: string; explanation: string };

type QuizPhase = 'answering' | 'submitted';

type ModalState =
  | { kind: 'flashcards'; name: string; detailTo: string; cards: CardData[]; idx: number; isFlipped: boolean }
  | {
    kind: 'quiz';
    name: string;
    detailTo: string;
    questions: QuestionData[];
    item: PendingItem;
    phase: QuizPhase;
    currentQ: number;
    /** questionId → selected option letter (A/B/C/D) */
    selected: Record<string, string>;
    score?: number;
    submitting?: boolean;
  }
  | null;

// ── helpers ───────────────────────────────────────────────────────────────────

function hashCode(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const DOODLES = ['✦', '◆', '▲', '●', '✿', '❋', '⬟'];
const PATTERNS = [
  'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)',
  'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 10px)',
  'radial-gradient(ellipse at top right, rgba(255,255,255,0.2) 0%, transparent 60%)',
];

const TYPE_META = {
  video: { Icon: Youtube, typeLabel: 'YouTube', emoji: '▶', fallbackColor: '#ef4444' },
  audio: { Icon: Mic, typeLabel: 'Audio', emoji: '🎙️', fallbackColor: '#f59e0b' },
  article: { Icon: Globe, typeLabel: 'Article', emoji: '🌐', fallbackColor: '#14b8a6' },
  document: { Icon: FileText, typeLabel: 'Document', emoji: '📄', fallbackColor: '#059669' },
} as const;

function getItemMeta(item: PendingItem, courses: Course[]) {
  if (item.kind === 'video') {
    const m = TYPE_META.video;
    return { ...m, id: item.video.id, name: item.video.title, accentColor: item.video.courseColor || m.fallbackColor, courseName: item.video.courseName || '', to: `/youtube/${item.video.id}` };
  }
  const { doc } = item;
  const course = courses.find(c => c.id === doc.courseId);
  const isArticle = !!doc.originalUrl;
  const kind: keyof typeof TYPE_META =
    doc.type === 'audio' ? 'audio' : isArticle ? 'article' : 'document';
  const m = TYPE_META[kind];
  return {
    ...m,
    id: doc.id,
    name: getDocDisplayName(doc),
    accentColor: course?.color || m.fallbackColor,
    courseName: course?.name || '',
    to: doc.type === 'audio' ? `/audio/${doc.id}` : isArticle ? `/articles/${doc.id}` : `/documents/${doc.id}`,
  };
}

function isCorrectOption(option: string, answer: string) {
  return option.trim().charAt(0).toUpperCase() === answer.trim().toUpperCase();
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
          const raw = await youtubeService.generateFlashcards(item.video.id, item.video.videoUrl);
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
          const raw = await youtubeService.generateQuiz(item.video.id, item.video.videoUrl);
          questions = raw.map(q => ({ id: q.quizId, question: q.question, options: q.options, answer: q.correctAnswer, explanation: q.explanation }));
        } else {
          const raw = await documentService.generateQuiz(item.doc.courseId || '', item.doc.id);
          questions = raw.map(q => ({ id: q.id, question: q.question, options: q.options, answer: q.answer, explanation: q.explanation }));
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

  const handleQuizSelect = (questionId: string, optionLetter: string) => {
    setModal(m => {
      if (m?.kind !== 'quiz' || m.phase !== 'answering') return m;
      const alreadyAnswered = questionId in m.selected;
      const newSelected = { ...m.selected, [questionId]: optionLetter };
      // Auto-advance only when answering for the first time
      const nextQ = !alreadyAnswered && m.currentQ < m.questions.length - 1
        ? m.currentQ + 1
        : m.currentQ;
      return { ...m, selected: newSelected, currentQ: nextQ };
    });
  };

  const handleQuizSubmit = async () => {
    if (modal?.kind !== 'quiz') return;
    setModal(m => m?.kind === 'quiz' ? { ...m, submitting: true } : m);
    const { questions, selected, item } = modal;
    const answers: Record<string, string> = { ...selected };
    const score = questions.filter(q => {
      const letter = selected[q.id];
      return letter && letter.toUpperCase() === q.answer.trim().toUpperCase();
    }).length;
    const total = questions.length;
    try {
      if (item.kind === 'doc') {
        await documentService.saveQuizSubmission(item.doc.courseId || '', item.doc.id, answers, score, total);
      } else {
        await youtubeService.submitQuiz(item.video.id, answers, score, total);
      }
    } catch { /* ignore */ }
    setModal(m => m?.kind === 'quiz' ? { ...m, phase: 'submitted', score, submitting: false } : m);
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
                        <img
                          src={item.video.thumbnailUrl}
                          alt={item.video.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={e => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${item.video.videoId}/mqdefault.jpg`; }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-200 flex items-center justify-center">
                          <Youtube size={12} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
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
                      className="flex items-center gap-1 text-[10px] font-bold text-text-muted hover:text-text-main transition-colors opacity-0 group-hover:opacity-100"
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

      {/* ── Generation result modal ── */}
      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={closeModal}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: 'spring', stiffness: 340, damping: 26 }}
              className="relative flex h-[60vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-4 sm:px-7 border-b border-zinc-100 shrink-0">
                <div className="flex min-w-0 items-center gap-2">
                  <Sparkles size={15} className="text-amber-400" />
                  <h3 className="shrink-0 font-bold text-sm text-zinc-900">
                    {modal.kind === 'flashcards'
                      ? `${modal.cards.length} Flashcard${modal.cards.length !== 1 ? 's' : ''} Generated`
                      : modal.phase === 'submitted'
                        ? 'Quiz Results'
                        : `${modal.questions.length} Question${modal.questions.length !== 1 ? 's' : ''}`}
                  </h3>
                  <span className="truncate rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 max-w-[220px] sm:max-w-md">{modal.name}</span>
                </div>
                <button onClick={closeModal} className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Modal body */}
              {modal.kind === 'flashcards' ? (
                <>
                  {/* Progress bar */}
                  <div className="h-1 bg-zinc-100 shrink-0">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${((modal.idx + 1) / modal.cards.length) * 100}%` }}
                    />
                  </div>

                  {/* Flip card */}
                  <div className="flex-1 overflow-hidden flex flex-col px-5 py-5 sm:px-8 sm:py-6 gap-5">
                    {/* Card */}
                    <div
                      className="flex-1 min-h-0 cursor-pointer select-none"
                      style={{ perspective: '1000px' }}
                      onClick={() => setModal(m => m?.kind === 'flashcards' ? { ...m, isFlipped: !m.isFlipped } : m)}
                    >
                      <div
                        className="relative w-full h-full transition-transform duration-500"
                        style={{ transformStyle: 'preserve-3d', transform: modal.isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
                      >
                        {/* Front */}
                        <div
                          className="absolute inset-0 rounded-2xl border-2 border-zinc-100 bg-zinc-50 flex flex-col items-center justify-center gap-3 p-6 overflow-y-auto"
                          style={{ backfaceVisibility: 'hidden' }}
                        >
                          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Question</span>
                          <p className="text-base font-semibold text-zinc-800 leading-relaxed text-center">{modal.cards[modal.idx].front}</p>
                          <span className="mt-2 text-[10px] text-zinc-400 font-medium">Tap to reveal answer</span>
                        </div>
                        {/* Back */}
                        <div
                          className="absolute inset-0 rounded-2xl border-2 border-primary/20 bg-primary/5 flex flex-col items-center justify-center gap-3 p-6 overflow-y-auto"
                          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                        >
                          <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">Answer</span>
                          <p className="text-base text-zinc-700 leading-relaxed text-center">{modal.cards[modal.idx].back}</p>
                          <span className="mt-2 text-[10px] text-zinc-400 font-medium">Tap to flip back</span>
                        </div>
                      </div>
                    </div>

                    {/* Card nav */}
                    <div className="flex items-center justify-between shrink-0">
                      <button
                        onClick={() => setModal(m => m?.kind === 'flashcards' ? { ...m, idx: Math.max(0, m.idx - 1), isFlipped: false } : m)}
                        disabled={modal.idx === 0}
                        className="flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronLeft size={13} /> Prev
                      </button>
                      <span className="text-xs font-semibold text-zinc-500">
                        {modal.idx + 1} / {modal.cards.length}
                      </span>
                      <button
                        onClick={() => setModal(m => m?.kind === 'flashcards' ? { ...m, idx: Math.min(m.cards.length - 1, m.idx + 1), isFlipped: false } : m)}
                        disabled={modal.idx === modal.cards.length - 1}
                        className="flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        Next <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3 sm:px-7 border-t border-zinc-100 flex items-center justify-between shrink-0">
                    <button onClick={closeModal} className="rounded-lg border border-zinc-200 px-4 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-all">
                      Done
                    </button>
                    <Link
                      to={modal.detailTo}
                      state={{ activeTab: 'flashcards' }}
                      onClick={closeModal}
                      className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary transition-colors"
                    >
                      Open detail <ChevronRight size={12} />
                    </Link>
                  </div>
                </>
              ) : modal.phase === 'answering' ? (
                <>
                  {/* Progress bar */}
                  <div className="h-1 bg-zinc-100 shrink-0">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${((modal.currentQ + 1) / modal.questions.length) * 100}%` }}
                    />
                  </div>

                  {/* Question */}
                  <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6 flex flex-col gap-5">
                    {(() => {
                      const q = modal.questions[modal.currentQ];
                      const selectedLetter = modal.selected[q.id];
                      const letters = ['A', 'B', 'C', 'D', 'E'];
                      return (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-black text-primary uppercase tracking-widest">
                              {modal.currentQ + 1} / {modal.questions.length}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-zinc-800 leading-relaxed">{q.question}</p>
                          <div className="space-y-2">
                            {q.options?.map((opt, oi) => {
                              const letter = letters[oi] ?? String(oi + 1);
                              const isSelected = selectedLetter === letter;
                              return (
                                <button
                                  key={oi}
                                  onClick={() => handleQuizSelect(q.id, letter)}
                                  className={cn(
                                    'w-full flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm text-left transition-all',
                                    isSelected
                                      ? 'border-primary bg-primary/5 text-primary font-semibold'
                                      : 'border-zinc-200 text-zinc-700 hover:border-primary/40 hover:bg-zinc-50',
                                  )}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3 sm:px-7 border-t border-zinc-100 flex items-center justify-between shrink-0">
                    <button
                      onClick={() => setModal(m => m?.kind === 'quiz' ? { ...m, currentQ: Math.max(0, m.currentQ - 1) } : m)}
                      disabled={modal.currentQ === 0}
                      className="flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft size={13} /> Prev
                    </button>
                    {modal.currentQ < modal.questions.length - 1 ? (
                      <button
                        onClick={() => setModal(m => m?.kind === 'quiz' ? { ...m, currentQ: m.currentQ + 1 } : m)}
                        className="flex items-center gap-1 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-white hover:brightness-110 transition-all"
                      >
                        Next <ChevronRight size={13} />
                      </button>
                    ) : (
                      <button
                        onClick={handleQuizSubmit}
                        disabled={modal.submitting || Object.keys(modal.selected).length === 0}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {modal.submitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        {modal.submitting ? 'Submitting…' : 'Submit Quiz'}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Results */}
                  <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6 flex flex-col gap-5">
                    {/* Score banner */}
                    {(() => {
                      const score = modal.score ?? 0;
                      const total = modal.questions.length;
                      const pct = Math.round((score / total) * 100);
                      const color = pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-orange-500' : 'text-red-500';
                      const bg = pct >= 80 ? 'bg-emerald-50 border-emerald-200' : pct >= 50 ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200';
                      return (
                        <div className={cn('flex flex-col items-center gap-1 rounded-2xl border py-5', bg)}>
                          <Trophy size={28} className={color} />
                          <p className={cn('text-3xl font-black', color)}>{score} / {total}</p>
                          <p className={cn('text-sm font-bold', color)}>{pct}%</p>
                        </div>
                      );
                    })()}

                    {/* Per-question review */}
                    <div className="space-y-3">
                      {modal.questions.map((q, i) => {
                        const letters = ['A', 'B', 'C', 'D', 'E'];
                        const userLetter = modal.selected[q.id];
                        const correct = userLetter && userLetter.toUpperCase() === q.answer.trim().toUpperCase();
                        return (
                          <div key={q.id} className={cn('rounded-xl border p-3 space-y-2', correct ? 'border-emerald-100 bg-emerald-50/50' : 'border-red-100 bg-red-50/50')}>
                            <div className="flex items-start gap-2">
                              {correct
                                ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                : <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />}
                              <p className="text-xs font-semibold text-zinc-800 leading-snug">
                                <span className="text-zinc-400 mr-1">{i + 1}.</span>{q.question}
                              </p>
                            </div>
                            <div className="pl-5 space-y-1">
                              {q.options?.map((opt, oi) => {
                                const letter = letters[oi] ?? String(oi + 1);
                                const isCorrectOpt = letter.toUpperCase() === q.answer.trim().toUpperCase();
                                const isUserPick = letter === userLetter;
                                return (
                                  <div key={oi} className={cn(
                                    'flex items-center gap-2 rounded-lg px-2 py-1 text-xs',
                                    isCorrectOpt ? 'bg-emerald-100 text-emerald-700 font-semibold' : isUserPick ? 'bg-red-100 text-red-600' : 'text-zinc-500',
                                  )}>
                                    <span className="shrink-0 font-bold">{letter}.</span>{opt}
                                    {isCorrectOpt && <CheckCircle2 size={11} className="ml-auto shrink-0 text-emerald-500" />}
                                    {isUserPick && !isCorrectOpt && <XCircle size={11} className="ml-auto shrink-0 text-red-400" />}
                                  </div>
                                );
                              })}
                              {q.explanation && (
                                <p className="text-[10px] text-zinc-500 italic pt-1">{q.explanation}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3 sm:px-7 border-t border-zinc-100 flex items-center justify-between shrink-0">
                    <button onClick={closeModal} className="rounded-lg border border-zinc-200 px-4 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-all">
                      Close
                    </button>
                    <Link
                      to={modal.detailTo}
                      state={{ activeTab: 'quiz' }}
                      onClick={closeModal}
                      className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-white hover:brightness-110 transition-all"
                    >
                      View Detail <ChevronRight size={13} />
                    </Link>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
