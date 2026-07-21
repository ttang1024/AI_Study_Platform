import { Directory, File, Paths } from 'expo-file-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { annotationsService, type DocumentAnnotation } from '@/services/annotationsService';
import { buildAnnotatedPdfHtml } from '@/utils/annotatedPdfHtml';

export interface NormRect { x: number; y: number; w: number; h: number }
export interface PdfSelection { text: string; rects: NormRect[] }

// Same palette as web's AnnotationToolbar.
export const HIGHLIGHT_COLORS = ['#FFFF00', '#90EE90', '#87CEEB', '#FF6B6B'];

const parseRects = (rectJson: string): NormRect[] => {
  try {
    const parsed = JSON.parse(rectJson);
    return Array.isArray(parsed) ? (parsed as NormRect[]) : [];
  } catch {
    return [];
  }
};

/**
 * Download the PDF in RN (no WebView CORS on presigned URLs) and hand it over
 * as base64. Goes through expo-file-system because RN's fetch can't turn a
 * response into a Blob/base64 ("Creating blobs from 'ArrayBuffer' … not
 * supported"), while File.base64() reads natively.
 */
async function fetchPdfBase64(url: string): Promise<string> {
  const dir = new Directory(Paths.cache, 'annotate-pdf');
  try {
    dir.create({ intermediates: true, idempotent: true });
  } catch { /* already exists */ }
  const target = new File(dir, `${Date.now()}.pdf`);
  const downloaded = await File.downloadFileAsync(url, target);
  try {
    return await downloaded.base64();
  } finally {
    try { downloaded.delete(); } catch { /* cache cleanup is best-effort */ }
  }
}

/**
 * WebView bridge + annotation state behind AnnotatedPdfViewer: pdf.js renders one page with a
 * selectable text layer in the WebView; this hook owns the postMessage protocol
 * (ready/loaded/page-rendered/selection/error), the annotations list, and persisting
 * highlights through the same normalized-rect coordinate space web uses.
 */
export function useAnnotatedPdfViewer(documentId: string, pdfUrl: string) {
  const webviewRef = useRef<WebView>(null);
  const [annotations, setAnnotations] = useState<DocumentAnnotation[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<PdfSelection | null>(null);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const pdfBase64Ref = useRef<string | null>(null);
  const readyRef = useRef(false);
  // html is stable — the document loads via injected JS, not source changes.
  const html = useMemo(() => buildAnnotatedPdfHtml(), []);

  useEffect(() => {
    annotationsService.getByDocument(documentId).then((res) => setAnnotations(res.data.data ?? [])).catch(() => {});
  }, [documentId]);

  useEffect(() => {
    let cancelled = false;
    fetchPdfBase64(pdfUrl)
      .then((b64) => {
        if (cancelled) return;
        pdfBase64Ref.current = b64;
        // If the WebView reported ready before the download finished, load now.
        if (readyRef.current) webviewRef.current?.injectJavaScript(`window.__loadPdf(${JSON.stringify(b64)}); true;`);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setErrorDetail(`fetch: ${e.message}`);
          setStatus('error');
        }
      });
    return () => { cancelled = true; };
  }, [pdfUrl]);

  const pushHighlights = useCallback((targetPage: number, all: DocumentAnnotation[]) => {
    const payload = all
      .filter((a) => a.pageNumber === targetPage)
      .map((a) => ({ id: a.documentAnnotationId, color: a.color, rects: parseRects(a.rectJson) }));
    webviewRef.current?.injectJavaScript(`window.__setHighlights(${JSON.stringify(payload)}); true;`);
  }, []);

  const onMessage = (e: WebViewMessageEvent) => {
    let payload: { type?: string; [k: string]: unknown };
    try {
      payload = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    switch (payload.type) {
      case 'ready':
        readyRef.current = true;
        if (pdfBase64Ref.current) {
          webviewRef.current?.injectJavaScript(`window.__loadPdf(${JSON.stringify(pdfBase64Ref.current)}); true;`);
        }
        break;
      case 'loaded':
        setNumPages(Number(payload.numPages) || 0);
        setStatus('ready');
        break;
      case 'page-rendered':
        setPage(Number(payload.page) || 1);
        pushHighlights(Number(payload.page) || 1, annotations);
        break;
      case 'selection':
        setSelection({ text: String(payload.text ?? ''), rects: (payload.rects as NormRect[]) ?? [] });
        break;
      case 'selection-clear':
        setSelection(null);
        break;
      case 'error':
        setErrorDetail(`viewer: ${String(payload.message ?? 'unknown')}`);
        setStatus('error');
        break;
    }
  };

  const dismissSelection = () => {
    setSelection(null);
    setNote('');
    webviewRef.current?.injectJavaScript('window.__clearSelection(); true;');
  };

  const saveAnnotation = async (color: string, makeFlashcard = false) => {
    if (!selection) return;
    try {
      const created = (
        await annotationsService.create(documentId, {
          highlightedText: selection.text,
          note: note.trim() || undefined,
          color,
          pageNumber: page,
          rectJson: JSON.stringify(selection.rects),
        })
      ).data.data;
      const next = [...annotations, created];
      setAnnotations(next);
      pushHighlights(page, next);
      if (makeFlashcard) {
        await annotationsService.createFlashcard(created.documentAnnotationId).catch(() => {
          Alert.alert('Highlight saved', 'But the flashcard couldn’t be created — try again from the list.');
        });
      }
    } catch {
      Alert.alert('Couldn’t save highlight', 'Check your connection and try again.');
    }
    dismissSelection();
  };

  const deleteAnnotation = (annotation: DocumentAnnotation) => {
    Alert.alert('Delete highlight', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await annotationsService.delete(annotation.documentAnnotationId).catch(() => {});
          const next = annotations.filter((a) => a.documentAnnotationId !== annotation.documentAnnotationId);
          setAnnotations(next);
          pushHighlights(page, next);
        },
      },
    ]);
  };

  const goToPage = (delta: number) => {
    const target = Math.min(Math.max(1, page + delta), numPages || 1);
    if (target !== page) webviewRef.current?.injectJavaScript(`window.__goToPage(${target}); true;`);
  };

  const goToAnnotationPage = (annotation: DocumentAnnotation) => {
    if (annotation.pageNumber !== page) webviewRef.current?.injectJavaScript(`window.__goToPage(${annotation.pageNumber}); true;`);
  };

  return {
    webviewRef, html, annotations, numPages, page, selection, note, setNote, status, errorDetail,
    onMessage, dismissSelection, saveAnnotation, deleteAnnotation, goToPage, goToAnnotationPage,
  };
}
