import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, RotateCcw, Brain, HelpCircle, Loader2, BrainCircuit } from 'lucide-react';
import { useStudy } from '../../context/StudyContext';
import { Button } from '../common/Button';
import { documentService } from '../../services/documentService';
import { getApiErrorCode } from '../../utils/apiError';
import { EmptyGenerationState, GenerationFailedState } from '../common/GenerationStates';

interface SimpleCard {
  id: string;
  front: string;
  back: string;
}

interface FlashcardsProps {
  documentId?: string;
  /** External flashcards (bypasses StudyContext when set) */
  externalCards?: SimpleCard[];
  /** External generate handler */
  onExternalGenerate?: () => Promise<void>;
  /** External loading state */
  isExternalGenerating?: boolean;
  /** External error message */
  externalError?: string | null;
  generateDisabled?: boolean;
  generateDisabledReason?: string;
}

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

  const isExternal = externalCards !== undefined || onExternalGenerate !== undefined;

  // Use the explicitly passed documentId, falling back to currentDocument
  const effectiveDoc = documentId
    ? documents.find(d => d.id === documentId) ?? currentDocument
    : currentDocument;

  const docFlashcards: SimpleCard[] = isExternal
    ? (externalCards ?? [])
    : flashcards.filter(f => f.documentId === (effectiveDoc?.id));

  const isGenerating = isExternal ? (isExternalGenerating ?? false) : isGeneratingLocal;
  const activeError = isExternal ? externalError : localError;

  // Load existing flashcards from DB on mount / document change (internal mode only)
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
      console.error('Flashcard generation error:', error);
      setLocalError(getApiErrorCode(error));
    } finally {
      setIsGeneratingLocal(false);
    }
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
      <div className="perspective-1000 relative h-[300px] sm:h-[400px] w-full cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
        <motion.div
          className="relative h-full w-full transition-all duration-500 preserve-3d"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden">
            <div className="flex h-full w-full flex-col items-center justify-center rounded-3xl border-2 border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6 sm:p-10 text-center shadow-xl">
              <span className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--primary)]">Concept</span>
              <h3 className="text-lg sm:text-2xl font-bold text-text-main leading-relaxed">
                {currentCard.front}
              </h3>
              <div className="absolute bottom-4 sm:bottom-8 text-[10px] sm:text-sm text-text-muted flex items-center gap-2">
                <HelpCircle size={14} />
                Click to reveal explanation
              </div>
            </div>
          </div>

          {/* Back */}
          <div className="absolute inset-0 backface-hidden rotate-y-180">
            <div className="flex h-full w-full flex-col items-center justify-center rounded-3xl border-2 border-[var(--primary)] bg-[var(--bg-app)] p-6 sm:p-12 text-center shadow-xl overflow-y-auto">
              <span className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--primary)]">Explanation</span>
              <p className="text-base sm:text-xl text-text-main leading-relaxed">
                {currentCard.back}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-4 sm:gap-8">
          <button
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="rounded-full border border-[var(--border-color)] p-2 sm:p-3 text-text-muted transition-all hover:bg-[var(--bg-sidebar)] hover:text-[var(--primary)]"
          >
            <ChevronLeft size={20} className="sm:w-6 sm:h-6" />
          </button>
          {isFlipped ? (
            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className="rounded-full bg-[var(--primary)] px-6 sm:px-8 py-2 sm:py-3 text-sm sm:text-base font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95"
            >
              Next Card
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setIsFlipped(true); }}
              className="rounded-full bg-[var(--primary)] px-6 sm:px-8 py-2 sm:py-3 text-sm sm:text-base font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95"
            >
              Reveal Answer
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="rounded-full border border-[var(--border-color)] p-2 sm:p-3 text-text-muted transition-all hover:bg-[var(--bg-sidebar)] hover:text-[var(--primary)]"
          >
            <ChevronRight size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
