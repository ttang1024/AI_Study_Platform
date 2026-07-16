import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../utils/cn';
import { getDocDisplayName } from '../../utils/docName';
import { Flashcard, Document } from '../../types';
import { VideoListItem } from '../../services/videoService';
import { Pagination } from '../../components/common/Pagination';
import { DIFFICULTY_COLORS } from '../../components/study/FlashcardClassifyModal';

interface ClassifiedCardListProps {
  cards: Flashcard[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  documents: Document[];
  videoList: VideoListItem[];
  onClassify: (card: Flashcard) => void;
}

/** Flat, flippable card list shown when classification filters are active. */
export const ClassifiedCardList: React.FC<ClassifiedCardListProps> = ({
  cards,
  page,
  totalPages,
  onPageChange,
  documents,
  videoList,
  onClassify,
}) => {
  const navigate = useNavigate();
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-color)] py-16 text-center bg-[var(--bg-sidebar)]">
        <div className="mb-4 rounded-2xl bg-zinc-100 p-6 text-zinc-300"><BrainCircuit size={40} /></div>
        <h3 className="text-lg font-bold text-text-main">No cards match your filters</h3>
        <p className="text-zinc-400 text-sm max-w-xs mx-auto mt-2">Try adjusting or clearing the filters above.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {cards.map(card => {
          const doc = documents.find(d => d.id === card.documentId);
          const vid = videoList.find(v => v.id === card.videoId);
          const sourceName = doc ? getDocDisplayName(doc) : vid?.title ?? card.documentName ?? card.videoName ?? '';
          const isFlipped = flippedCards.has(card.id);
          return (
            <motion.div
              key={card.id}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setFlippedCards(prev => {
                const next = new Set(prev);
                next.has(card.id) ? next.delete(card.id) : next.add(card.id);
                return next;
              })}
              className="flex items-start gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 hover:border-[var(--primary)]/30 transition-colors cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-main line-clamp-2">{card.front}</p>
                <AnimatePresence>
                  {isFlipped && (
                    <motion.p
                      key="back"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-sm text-text-muted mt-2 pt-2 border-t border-[var(--border-color)] overflow-hidden"
                    >
                      {card.back}
                    </motion.p>
                  )}
                </AnimatePresence>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold border', DIFFICULTY_COLORS[card.difficulty])}>
                    {card.difficulty}
                  </span>
                  {card.chapter && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {card.chapter}
                    </span>
                  )}
                  {card.tags?.map(t => (
                    <span key={t} className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--primary)]">
                      #{t}
                    </span>
                  ))}
                  {sourceName && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const state = { activeTab: 'flashcards' };
                        if (card.videoId) {
                          navigate(`/videos/${card.videoId}`, { state });
                        } else if (doc?.originalUrl) {
                          navigate(`/articles/${card.documentId}`, { state });
                        } else if (doc?.type === 'audio' || doc?.type === 'podcast') {
                          navigate(`/audio/${card.documentId}`, { state });
                        } else if (card.documentId) {
                          navigate(`/documents/${card.documentId}`, { state });
                        }
                      }}
                      className="text-[10px] text-text-muted ml-0.5 hover:text-[var(--primary)] hover:underline transition-colors"
                    >
                      {sourceName}
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onClassify(card); }}
                className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-[var(--bg-sidebar)] hover:text-[var(--primary)] transition-colors"
                title="Edit classification"
              >
                <Pencil size={14} />
              </button>
            </motion.div>
          );
        })}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={(p) => { onPageChange(p); document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' }); }}
        size="sm"
      />
    </>
  );
};
