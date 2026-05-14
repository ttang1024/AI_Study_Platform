import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, RotateCcw, Brain, Loader2, BrainCircuit } from 'lucide-react';
import { useStudy } from '../../context/StudyContext';
import { Button } from '../common/Button';
import { documentService } from '../../services/documentService';
import { flashcardService } from '../../services/flashcardService';
import { getApiErrorCode } from '../../utils/apiError';
import { EmptyGenerationState, GenerationFailedState } from '../common/GenerationStates';
import { FlashcardSrsState } from '../../types';
import { cn } from '../../utils/cn';
import { FlashcardFlipCard } from './FlashcardFlipCard';

interface SimpleCard {
  id: string;
  front: string;
  back: string;
  cardType?: 'basic' | 'cloze' | 'chart';
  srs?: FlashcardSrsState;
}

interface FlashcardsProps {
  documentId?: string;
  externalCards?: SimpleCard[];
  onExternalGenerate?: () => Promise<void>;
  isExternalGenerating?: boolean;
  externalError?: string | null;
  generateDisabled?: boolean;
  generateDisabledReason?: string;
}

const RATING_BUTTONS = [
  { rating: 1 as const, label: 'Again', color: 'bg-red-500 hover:bg-red-600', textColor: 'text-red-600', borderColor: 'border-red-200', bgLight: 'bg-red-50' },
  { rating: 2 as const, label: 'Hard',  color: 'bg-orange-500 hover:bg-orange-600', textColor: 'text-orange-600', borderColor: 'border-orange-200', bgLight: 'bg-orange-50' },
  { rating: 3 as const, label: 'Good',  color: 'bg-green-500 hover:bg-green-600', textColor: 'text-green-600', borderColor: 'border-green-200', bgLight: 'bg-green-50' },
  { rating: 4 as const, label: 'Easy',  color: 'bg-blue-500 hover:bg-blue-600', textColor: 'text-blue-600', borderColor: 'border-blue-200', bgLight: 'bg-blue-50' },
] as const;

const STATE_LABELS: Record<number, string> = { 0: 'New', 1: 'Learning', 2: 'Review', 3: 'Relearning' };

export const Flashcards: React.FC<FlashcardsProps> = ({
  documentId,
  externalCards,
  onExternalGenerate,
  isExternalGenerating,
  externalError,
  generateDisabled = false,
  generateDisabledReason,
}) => {
  const { flashcards, setFlashcards, currentDocument, documents } = useStudy();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isGeneratingLocal, setIsGeneratingLocal] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [srsMap, setSrsMap] = useState<Map<string, FlashcardSrsState>>(new Map());
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const isExternal = externalCards !== undefined || onExternalGenerate !== undefined;

  const effectiveDoc = documentId
    ? documents.find(d => d.id === documentId) ?? currentDocument
    : currentDocument;

  const docFlashcards: SimpleCard[] = isExternal
    ? (externalCards ?? [])
    : flashcards.filter(f => f.documentId === (effectiveDoc?.id));

  const isGenerating = isExternal ? (isExternalGenerating ?? false) : isGeneratingLocal;
  const activeError = isExternal ? externalError : localError;

  useEffect(() => {
    if (isExternal || !effectiveDoc?.courseId || !effectiveDoc?.id) return;
    const { courseId, id: docId } = effectiveDoc;
    setIsGeneratingLocal(true);
    documentService.getFlashcards(courseId, docId)
      .then(cards => {
        if (cards.length > 0) {
          setFlashcards(prev => {
            const existingIds = new Set(prev.map(f => f.id));
            const incoming = cards.filter(c => !existingIds.has(c.id));
            return [...prev, ...incoming];
          });
        }
      })
      .catch(() => { })
      .finally(() => setIsGeneratingLocal(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDoc?.id, isExternal]);

  useEffect(() => {
    if (isExternal) return;
    flashcardService.getSrsStates()
      .then(map => setSrsMap(map))
      .catch(() => { });
  }, [isExternal]);

  const handleGenerate = async () => {
    if (generateDisabled) return;
    if (isExternal && onExternalGenerate) {
      await onExternalGenerate();
      setCurrentIndex(0);
      setIsFlipped(false);
      return;
    }
    if (!effectiveDoc) return;
    setIsGeneratingLocal(true);
    setLocalError(null);
    try {
      const cards = await documentService.generateFlashcards(
        effectiveDoc.courseId || '',
        effectiveDoc.id
      );
      setFlashcards(prev => {
        const existingIds = new Set(prev.map(f => f.id));
        const newCards = cards.filter(c => !existingIds.has(c.id));
        return [...prev, ...newCards];
      });
    } catch (error) {
      setLocalError(getApiErrorCode(error));
    } finally {
      setIsGeneratingLocal(false);
    }
  };

  const ratingToDifficulty = (r: 1 | 2 | 3 | 4): 'easy' | 'medium' | 'hard' =>
    r === 4 ? 'easy' : r === 3 ? 'medium' : 'hard';

  const handleRate = async (rating: 1 | 2 | 3 | 4) => {
    const card = docFlashcards[currentIndex];
    if (!card || reviewingId) return;
    setReviewingId(card.id);
    const newDifficulty = ratingToDifficulty(rating);
    const [reviewResult] = await Promise.allSettled([
      flashcardService.reviewFlashcard(card.id, rating),
      flashcardService.classifyFlashcard(card.id, { difficulty: newDifficulty }),
    ]);
    if (reviewResult.status === 'fulfilled') {
      setSrsMap(prev => new Map(prev).set(card.id, reviewResult.value.srs));
    }
    setFlashcards(prev => prev.map(f => f.id === card.id ? { ...f, difficulty: newDifficulty } : f));
    setReviewingId(null);
    setIsFlipped(false);
    setCurrentIndex(prev => (prev + 1) % docFlashcards.length);
  };

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-[var(--primary)]" />
        <p className="text-sm text-zinc-500">Generating flashcards...</p>
      </div>
    );
  }

  if (activeError && docFlashcards.length === 0) {
    return (
      <GenerationFailedState message={activeError} onRetry={handleGenerate} retryDisabled={generateDisabled} disabledReason={generateDisabledReason} />
    );
  }

  if (docFlashcards.length === 0) {
    return (
      <EmptyGenerationState
        icon={BrainCircuit}
        title="No Flashcards Yet"
        description="Generate AI-powered flashcards."
        actionLabel="Generate Flashcards"
        onAction={handleGenerate}
        actionDisabled={generateDisabled}
        disabledReason={generateDisabledReason}
      />
    );
  }

  const currentCard = docFlashcards[currentIndex];
  const cardSrs = srsMap.get(currentCard.id);

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % docFlashcards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + docFlashcards.length) % docFlashcards.length);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[var(--primary)]/10 p-2 text-[var(--primary)]">
            <Brain size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-main">Flashcard Review</h2>
            <p className="text-sm text-text-muted">
              Card {currentIndex + 1} of {docFlashcards.length}
              {cardSrs && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                  {STATE_LABELS[cardSrs.state]} · {Math.round(cardSrs.retrievability * 100)}%
                </span>
              )}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setCurrentIndex(0); setIsFlipped(false); }}>
          <RotateCcw size={16} className="mr-2" />
          Reset
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border-color)]">
        <motion.div
          className="h-full bg-[var(--primary)]"
          initial={{ width: 0 }}
          animate={{ width: `${((currentIndex + 1) / docFlashcards.length) * 100}%` }}
        />
      </div>

      {/* Card */}
      <FlashcardFlipCard
        front={currentCard.front}
        back={currentCard.back}
        cardType={currentCard.cardType}
        isFlipped={isFlipped}
        onFlip={() => setIsFlipped(!isFlipped)}
      />

      {/* Controls */}
      <div className="flex flex-col items-center gap-6">
        {/* Navigation */}
        <div className="flex items-center gap-4 sm:gap-8">
          <button
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="rounded-full border border-[var(--border-color)] p-2 sm:p-3 text-text-muted transition-all hover:bg-[var(--bg-sidebar)] hover:text-[var(--primary)]"
          >
            <ChevronLeft size={20} className="sm:w-6 sm:h-6" />
          </button>

          {!isFlipped ? (
            <button
              onClick={(e) => { e.stopPropagation(); setIsFlipped(true); }}
              className="rounded-full bg-[var(--primary)] px-6 sm:px-8 py-2 sm:py-3 text-sm sm:text-base font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95"
            >
              Reveal Answer
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className="rounded-full border border-[var(--border-color)] px-6 sm:px-8 py-2 sm:py-3 text-sm sm:text-base font-bold text-text-muted transition-all hover:bg-[var(--bg-sidebar)]"
            >
              Skip
            </button>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="rounded-full border border-[var(--border-color)] p-2 sm:p-3 text-text-muted transition-all hover:bg-[var(--bg-sidebar)] hover:text-[var(--primary)]"
          >
            <ChevronRight size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* FSRS Rating Buttons — shown after flipping */}
        {isFlipped && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
          >
            <p className="text-center text-xs font-semibold text-text-muted mb-3 uppercase tracking-widest">How well did you remember?</p>
            <div className="grid grid-cols-4 gap-2">
              {RATING_BUTTONS.map(({ rating, label, bgLight, textColor, borderColor }) => (
                <button
                  key={rating}
                  onClick={(e) => { e.stopPropagation(); handleRate(rating); }}
                  disabled={!!reviewingId}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-2xl border-2 px-2 py-3 text-xs font-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50',
                    bgLight, textColor, borderColor,
                  )}
                >
                  <span className="text-sm">{label}</span>
                  {reviewingId === currentCard.id ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : null}
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-2 px-1 text-[10px] text-text-muted">
              <span>Forgot</span>
              <span>Too easy</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
