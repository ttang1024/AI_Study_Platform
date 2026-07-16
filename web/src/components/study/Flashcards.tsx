import React, { useState, useEffect } from 'react';
import { Loader2, BrainCircuit } from 'lucide-react';
import { useStudy } from '../../context/StudyContext';
import { documentService } from '../../services/documentService';
import { getApiErrorCode } from '../../utils/apiError';
import { EmptyGenerationState, GenerationFailedState } from '../common/GenerationStates';
import { FlashcardSrsState } from '../../types';
import { FlashcardSessionDeck } from './FlashcardSessionCard';

interface SimpleCard {
  id: string;
  front: string;
  back: string;
  cardType?: 'basic' | 'cloze' | 'chart' | 'occlusion';
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

export const Flashcards: React.FC<FlashcardsProps> = ({
  documentId,
  externalCards,
  onExternalGenerate,
  isExternalGenerating,
  externalError,
  generateDisabled = false,
  generateDisabledReason,
}) => {
  const { flashcards, setFlashcards, currentDocument, documents, ensureDocuments } = useStudy();

  // documents is loaded lazily by StudyContext; pull it so a documentId lookup
  // can resolve when this renders outside an already-loaded detail page.
  useEffect(() => { void ensureDocuments(); }, [ensureDocuments]);
  const [isGeneratingLocal, setIsGeneratingLocal] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

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

  const handleGenerate = async () => {
    if (generateDisabled) return;
    if (isExternal && onExternalGenerate) {
      await onExternalGenerate();
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

  return (
    <FlashcardSessionDeck
      cards={docFlashcards}
      title={effectiveDoc?.name ?? 'Flashcards'}
      variant="inline"
    />
  );
};
