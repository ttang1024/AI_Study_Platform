import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import type { DocumentStaleness } from '@core/services/documentService';
import { documentService } from '../../services/documentService';

interface Props {
  documentId: string;
  /** Called after artifacts are cleared, so the page can refetch what it shows. */
  onRegenerated?: () => void;
}

/**
 * Shown when the document's file has been replaced since its study material was generated.
 *
 * Deliberately an explicit prompt rather than an automatic rebuild: regenerating throws away the
 * existing cards, and with them their FSRS scheduling. That is the learner's call, not ours.
 */
export const StaleSourceBanner: React.FC<Props> = ({ documentId, onRegenerated }) => {
  const [staleness, setStaleness] = useState<DocumentStaleness | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await documentService.getStaleness(documentId);
      setStaleness(res.data?.data ?? null);
    } catch {
      setStaleness(null);
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!staleness?.hasStaleArtifacts) return null;

  const parts: string[] = [];
  if (staleness.staleFlashcards > 0) parts.push(`${staleness.staleFlashcards} flashcards`);
  if (staleness.staleQuizzes > 0) parts.push(`${staleness.staleQuizzes} quiz questions`);
  if (staleness.staleGlossaryTerms > 0) parts.push(`${staleness.staleGlossaryTerms} glossary terms`);
  if (staleness.summaryStale) parts.push('the summary');
  if (staleness.mindMapStale) parts.push('the mind map');

  const regenerate = async () => {
    setBusy(true);
    try {
      await documentService.regenerateStale(documentId);
      await load();
      onRegenerated?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4">
      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          This document's file was replaced
          {staleness.sourceChangedAt && ` on ${new Date(staleness.sourceChangedAt).toLocaleDateString()}`}.
        </p>
        <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
          {parts.join(', ')} were generated from the previous version. Rebuilding discards them, including
          any review history on those cards.
        </p>
      </div>
      <button
        onClick={() => void regenerate()}
        disabled={busy}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 shrink-0"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        Rebuild
      </button>
    </div>
  );
};

export default StaleSourceBanner;
