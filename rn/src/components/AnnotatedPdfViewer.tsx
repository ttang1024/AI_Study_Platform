import { Directory, File, Paths } from 'expo-file-system';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { BrainCircuit, ChevronLeft, ChevronRight, Highlighter, Trash2, X } from 'lucide-react-native';

import { Alpha, Colors, Layout, Overlay, Radius, Spacing, Typography } from '@/constants/theme';
import { annotationsService, type DocumentAnnotation } from '@/services/annotationsService';
import { buildAnnotatedPdfHtml } from '@/utils/annotatedPdfHtml';

interface AnnotatedPdfViewerProps {
  documentId: string;
  pdfUrl: string;
}

interface NormRect { x: number; y: number; w: number; h: number }
interface Selection { text: string; rects: NormRect[] }

// Same palette as web's AnnotationToolbar.
const COLORS = ['#FFFF00', '#90EE90', '#87CEEB', '#FF6B6B'];

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
 * Mobile port of web's AnnotatedPdfViewer: pdf.js in a WebView renders one page
 * with a selectable text layer; long-press-selecting text surfaces a native
 * color/note action bar; highlights persist through the same annotations API
 * and normalized-rect coordinate space, so web and mobile see each other's
 * highlights. The web sidebar becomes an annotation list under the viewer.
 */
export const AnnotatedPdfViewer: React.FC<AnnotatedPdfViewerProps> = ({ documentId, pdfUrl }) => {
  const { width } = useWindowDimensions();
  const webviewRef = useRef<WebView>(null);
  const [annotations, setAnnotations] = useState<DocumentAnnotation[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<Selection | null>(null);
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

  if (status === 'error') {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>Couldn’t load this PDF for annotating.</Text>
        {!!errorDetail && <Text style={styles.errorText}>{errorDetail}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.pager}>
        <Pressable onPress={() => goToPage(-1)} disabled={page <= 1} hitSlop={8}>
          <ChevronLeft size={18} color={page <= 1 ? Colors.border : Colors.textPrimary} />
        </Pressable>
        <Text style={styles.pagerText}>
          {numPages > 0 ? `Page ${page} of ${numPages}` : 'Loading…'}
        </Text>
        <Pressable onPress={() => goToPage(1)} disabled={page >= numPages} hitSlop={8}>
          <ChevronRight size={18} color={page >= numPages ? Colors.border : Colors.textPrimary} />
        </Pressable>
        <Text style={styles.pagerHint}>Long-press text to highlight</Text>
      </View>

      <View style={[styles.viewerBox, { height: width * 1.35 }]}>
        <WebView
          ref={webviewRef}
          source={{ html }}
          style={styles.webview}
          originWhitelist={['*']}
          onMessage={onMessage}
          bounces={false}
          menuItems={[]}
        />
        {status === 'loading' && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        )}

        {selection && (
          <View style={styles.actionBar}>
            <View style={styles.actionHeader}>
              <Text style={styles.actionText} numberOfLines={1}>“{selection.text}”</Text>
              <Pressable onPress={dismissSelection} hitSlop={8}>
                <X size={16} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note (optional)"
              placeholderTextColor={Colors.textSecondary}
              style={styles.noteInput}
            />
            <View style={styles.actionRow}>
              {COLORS.map((color) => (
                <Pressable
                  key={color}
                  style={[styles.colorDot, { backgroundColor: color }]}
                  onPress={() => saveAnnotation(color)}
                  accessibilityLabel={`Highlight in ${color}`}
                />
              ))}
              <View style={styles.actionSpacer} />
              <Pressable style={styles.flashcardButton} onPress={() => saveAnnotation(COLORS[0], true)}>
                <BrainCircuit size={13} color={Colors.primaryForeground} />
                <Text style={styles.flashcardButtonText}>Flashcard</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {annotations.length > 0 && (
        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <Highlighter size={14} color={Colors.primary} />
            <Text style={styles.listTitle}>Highlights ({annotations.length})</Text>
          </View>
          {annotations.map((a) => (
            <View key={a.documentAnnotationId} style={styles.annotationRow}>
              <View style={[styles.annotationDot, { backgroundColor: a.color }]} />
              <Pressable
                style={styles.annotationBody}
                onPress={() => {
                  if (a.pageNumber !== page) webviewRef.current?.injectJavaScript(`window.__goToPage(${a.pageNumber}); true;`);
                }}
              >
                <Text style={styles.annotationText} numberOfLines={3}>{a.highlightedText}</Text>
                {!!a.note && <Text style={styles.annotationNote} numberOfLines={2}>{a.note}</Text>}
                <Text style={styles.annotationMeta}>Page {a.pageNumber}</Text>
              </Pressable>
              <Pressable onPress={() => deleteAnnotation(a)} hitSlop={8}>
                <Trash2 size={15} color={Colors.red} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  pager: {
    ...Layout.row, gap: Spacing.two,
    backgroundColor: Colors.bgSidebar, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.two, paddingVertical: 8,
  },
  pagerText: { ...Typography.captionBold, color: Colors.textPrimary },
  pagerHint: { ...Typography.caption, color: Colors.textSecondary, flex: 1, textAlign: 'right' },
  viewerBox: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg,
    overflow: 'hidden', backgroundColor: Colors.zinc200,
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    ...Layout.center, backgroundColor: Overlay.panel,
  },
  actionBar: {
    position: 'absolute', left: Spacing.two, right: Spacing.two, bottom: Spacing.two,
    backgroundColor: Overlay.panel, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.two, gap: Spacing.two,
  },
  actionHeader: { ...Layout.row, gap: Spacing.two },
  actionText: { ...Typography.caption, color: Colors.textSecondary, flex: 1, fontStyle: 'italic' },
  noteInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two, paddingVertical: 6, fontSize: 13, color: Colors.textPrimary,
    backgroundColor: Colors.bgCard,
  },
  actionRow: { ...Layout.row, gap: Spacing.two },
  colorDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: `${Colors.textPrimary}${Alpha.strong}`,
  },
  actionSpacer: { flex: 1 },
  flashcardButton: {
    ...Layout.row, gap: 5,
    backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  flashcardButtonText: { ...Typography.captionBold, color: Colors.primaryForeground },
  errorBox: {
    backgroundColor: Colors.bgSidebar, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.four, alignItems: 'center',
  },
  errorText: { ...Typography.caption, color: Colors.textSecondary },
  listSection: {
    backgroundColor: Colors.bgSidebar, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two,
  },
  listHeader: { ...Layout.row, gap: 6 },
  listTitle: { ...Typography.captionBold, color: Colors.primary },
  annotationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  annotationDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  annotationBody: { flex: 1, gap: 2 },
  annotationText: { ...Typography.caption, color: Colors.textPrimary },
  annotationNote: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic' },
  annotationMeta: { fontSize: 10, color: Colors.textSecondary },
});
