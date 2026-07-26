import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { documentService } from '../../services/documentService';

interface Props {
  documentId: string;
  /** Character range to highlight, from a citation's `?highlight=start-end`. */
  highlight?: { start: number; end: number } | null;
}

/**
 * The document's extracted text, with the cited passage highlighted.
 *
 * This exists so a citation has somewhere to land. The server returns the same string the anchor
 * offsets were computed against, which is the whole reason the text is extracted once and stored
 * rather than re-derived per request — PDF and image extraction falls back to AI transcription, and
 * a second pass would quietly shift every offset.
 */
export const DocumentSourceView: React.FC<Props> = ({ documentId, highlight }) => {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const markRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    void (async () => {
      try {
        const res = await documentService.getText(documentId);
        if (!cancelled) setText(res.data?.data?.text ?? null);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const scrollToHighlight = useCallback(() => {
    markRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  useEffect(() => {
    if (!loading && highlight && markRef.current) scrollToHighlight();
  }, [loading, highlight, scrollToHighlight]);

  // Split rather than dangerouslySetInnerHTML: the text is extracted from a user-supplied file and
  // must never be interpreted as markup.
  const segments = useMemo(() => {
    if (!text) return null;
    if (!highlight) return { before: text, marked: '', after: '' };

    const start = Math.max(0, Math.min(highlight.start, text.length));
    const end = Math.max(start, Math.min(highlight.end, text.length));

    return { before: text.slice(0, start), marked: text.slice(start, end), after: text.slice(end) };
  }, [text, highlight]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-text-muted">
        <Loader2 className="w-4 h-4 animate-spin" /> Extracting text…
      </div>
    );
  }

  if (failed || !segments) {
    return (
      <div className="p-6 text-center">
        <FileText className="w-8 h-8 text-text-muted mx-auto" />
        <p className="mt-3 text-sm text-text-muted">
          {failed
            ? 'Could not load this document’s text.'
            : 'This document has no extractable text layer — images are not transcribed automatically.'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {highlight && segments.marked && (
        <button
          onClick={scrollToHighlight}
          className="mb-4 text-xs text-teal-600 hover:text-teal-700 underline underline-offset-2"
        >
          Scroll to the cited passage
        </button>
      )}

      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-text-main">
        {segments.before}
        {segments.marked && (
          <mark
            ref={markRef as React.RefObject<HTMLElement>}
            className="bg-amber-200 dark:bg-amber-700/60 text-text-main rounded px-0.5"
          >
            {segments.marked}
          </mark>
        )}
        {segments.after}
      </pre>
    </div>
  );
};

export default DocumentSourceView;
