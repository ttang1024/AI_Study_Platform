import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

interface AutoHeightWebViewProps {
  html: string;
  /** Disable touch so a wrapping Pressable (e.g. a flashcard) still gets taps. */
  pointerEventsNone?: boolean;
}

/**
 * A WebView that grows to its content's natural height, so HTML content
 * behaves like ordinary inline content inside ScrollViews. The document must
 * post `{type:'height', height}` via ReactNativeWebView (see HtmlContent's
 * wrapper and utils/mathMarkdownHtml.ts, which both embed that script).
 */
export const AutoHeightWebView: React.FC<AutoHeightWebViewProps> = ({ html, pointerEventsNone }) => {
  const [height, setHeight] = useState(40);
  const source = useMemo(() => ({ html }), [html]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(e.nativeEvent.data);
      if (payload.type === 'height' && typeof payload.height === 'number' && payload.height > 0) {
        setHeight(Math.ceil(payload.height));
      }
    } catch { /* ignore malformed messages */ }
  };

  return (
    <View style={{ height }} pointerEvents={pointerEventsNone ? 'none' : 'auto'}>
      <WebView
        source={source}
        style={{ height, backgroundColor: 'transparent' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        scrollEnabled={false}
        bounces={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};
