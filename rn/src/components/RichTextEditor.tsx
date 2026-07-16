import React, { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Bold, Italic, List, ListOrdered } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { PressableScale } from '@/components/PressableScale';
import { Colors, Layout, Radius, Spacing } from '@/constants/theme';

interface RichTextEditorProps {
  initialHtml: string;
  onChangeHtml: (html: string) => void;
}

// Mirrors the web tiptap toolbar (RichTextEditor.tsx): bold, italic, bullet and
// numbered lists. document.execCommand is deprecated-but-universal in both
// WKWebView and Android WebView, and emits the same semantic HTML
// (<strong>/<em>/<ul>/<ol>) that tiptap produces, so notes round-trip cleanly.
const COMMANDS: { icon: LucideIcon; command: string }[] = [
  { icon: Bold, command: 'bold' },
  { icon: Italic, command: 'italic' },
  { icon: List, command: 'insertUnorderedList' },
  { icon: ListOrdered, command: 'insertOrderedList' },
];

const buildEditorHtml = (initialHtml: string) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; background: transparent; height: 100%; }
  #editor {
    font-family: -apple-system, system-ui, sans-serif;
    font-size: 15px; line-height: 1.55; color: #1f2937;
    min-height: 100%; padding: 12px; outline: none;
    -webkit-user-select: text; user-select: text;
  }
  #editor:empty::before { content: 'Write your note…'; color: #9ca3af; }
  ul, ol { padding-left: 22px; }
  p { margin: 0 0 8px; }
</style>
</head>
<body>
<div id="editor" contenteditable="true">${initialHtml}</div>
<script>
(function () {
  var editor = document.getElementById('editor');
  function post() {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'html', html: editor.innerHTML }));
    }
  }
  var t = null;
  editor.addEventListener('input', function () {
    clearTimeout(t);
    t = setTimeout(post, 250);
  });
  window.__exec = function (command) {
    document.execCommand(command, false, null);
    editor.focus();
    post();
  };
})();
</script>
</body>
</html>`;

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ initialHtml, onChangeHtml }) => {
  const webviewRef = useRef<WebView>(null);
  // The WebView owns the document after mount; initialHtml is intentionally
  // captured once so parent re-renders don't clobber in-progress typing.
  const html = useMemo(() => buildEditorHtml(initialHtml), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(e.nativeEvent.data);
      if (payload.type === 'html' && typeof payload.html === 'string') onChangeHtml(payload.html);
    } catch { /* ignore malformed messages */ }
  };

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        {COMMANDS.map(({ icon: Icon, command }) => (
          <PressableScale
            key={command}
            style={styles.toolButton}
            onPress={() => webviewRef.current?.injectJavaScript(`window.__exec(${JSON.stringify(command)}); true;`)}
          >
            <Icon size={16} color={Colors.textPrimary} />
          </PressableScale>
        ))}
      </View>
      <WebView
        ref={webviewRef}
        source={{ html }}
        style={styles.webview}
        originWhitelist={['*']}
        onMessage={onMessage}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        bounces={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg,
    backgroundColor: Colors.bgSidebar, overflow: 'hidden',
  },
  toolbar: {
    flexDirection: 'row', gap: 4, padding: Spacing.one,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bgCard,
  },
  toolButton: {
    width: 34, height: 34, borderRadius: Radius.sm,
    ...Layout.center,
  },
  toolButtonPressed: { backgroundColor: Colors.zinc200 },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
