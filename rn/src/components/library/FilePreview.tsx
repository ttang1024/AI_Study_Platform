import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';

import { Colors, Radius } from '@/constants/theme';
import type { Document } from '@/types';

export function FilePreview({ url, type }: { url: string; type: Document['type'] }) {
  const { width } = useWindowDimensions();
  // PDFs render natively in both WKWebView (iOS) and the Chromium-based
  // Android WebView, so load them directly. Only docx needs an external
  // renderer, and even that only works reliably against a publicly
  // reachable URL — Google's gview endpoint often fails against
  // short-lived, signed download URLs (returns "No preview available").
  const source = type === 'docx'
    ? { uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}` }
    : { uri: url };

  return (
    <View style={[styles.previewBox, { height: width * 1.3 }]}>
      <WebView
        source={source}
        style={styles.previewWebView}
        originWhitelist={['*']}
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
});
