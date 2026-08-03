import { ActivityIndicator, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { DocumentFileView, TEXT_VIEWER_KINDS } from '@/components/library/viewers/DocumentFileView';
import { getDocumentViewerKind } from '@core/services/documentService';
import type { Document } from '@/types';

export function FilePreview({ url, doc }: { url: string; doc: Document }) {
  const { width } = useWindowDimensions();
  const kind = getDocumentViewerKind(doc);

  // Source, data, tables, notebooks and captions render natively — a WebView
  // would only show them as unstyled, unhighlighted text. Boxed to the same
  // height as the WebView preview so a long file cannot push the tabs below it
  // off the screen.
  if (TEXT_VIEWER_KINDS.includes(kind))
    return (
      <View style={[styles.nativeBox, { height: width * 1.3 }]}>
        <ScrollView contentContainerStyle={styles.nativeInner}>
          <DocumentFileView url={url} fileName={doc.name} kind={kind} />
        </ScrollView>
      </View>
    );

  // PDFs render natively in both WKWebView (iOS) and the Chromium-based
  // Android WebView, so load them directly. Only docx needs an external
  // renderer, and even that only works reliably against a publicly
  // reachable URL — Google's gview endpoint often fails against
  // short-lived, signed download URLs (returns "No preview available").
  const source = doc.type === 'docx'
    ? { uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}` }
    : { uri: url };

  return (
    <View style={[styles.previewBox, { height: width * 1.3 }]}>
      <WebView
        source={source}
        style={styles.previewWebView}
        originWhitelist={['*']}
        // Uploaded HTML is someone else's markup; there is no reason to let it
        // run scripts just to be read.
        javaScriptEnabled={kind !== 'html'}
        startInLoadingState
        renderLoading={() => <ActivityIndicator style={StyleSheet.absoluteFill} color={Colors.primary} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  previewBox: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg,
    overflow: 'hidden', backgroundColor: Colors.bgSidebar,
  },
  previewWebView: { flex: 1, backgroundColor: 'transparent' },
  nativeBox: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg,
    overflow: 'hidden', backgroundColor: Colors.bgSidebar,
  },
  nativeInner: { padding: Spacing.two },
});
