import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';

import { Colors, Layout, Overlay, Radius, Spacing, Typography } from '@/constants/theme';
import { useAnnotatedPdfViewer } from '@/hooks/useAnnotatedPdfViewer';
import { PdfAnnotationActionBar } from '@/components/PdfAnnotationActionBar';
import { PdfAnnotationList } from '@/components/PdfAnnotationList';

interface AnnotatedPdfViewerProps {
  documentId: string;
  pdfUrl: string;
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
  const {
    webviewRef, html, annotations, numPages, page, selection, note, setNote, status, errorDetail,
    onMessage, dismissSelection, saveAnnotation, deleteAnnotation, goToPage, goToAnnotationPage,
  } = useAnnotatedPdfViewer(documentId, pdfUrl);

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
          <PdfAnnotationActionBar
            selection={selection}
            note={note}
            setNote={setNote}
            onDismiss={dismissSelection}
            onSave={saveAnnotation}
          />
        )}
      </View>

      <PdfAnnotationList annotations={annotations} onSelect={goToAnnotationPage} onDelete={deleteAnnotation} />
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
  errorBox: {
    backgroundColor: Colors.bgSidebar, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.four, alignItems: 'center',
  },
  errorText: { ...Typography.caption, color: Colors.textSecondary },
});
