import React, { useMemo } from 'react';

import { AutoHeightWebView } from '@/components/AutoHeightWebView';
import { Colors } from '@/constants/theme';

interface HtmlContentProps {
  html: string;
}

const wrap = (html: string) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  body {
    font-family: -apple-system, system-ui, sans-serif;
    font-size: 14px; line-height: 1.55; color: #1f2937; overflow-wrap: break-word;
  }
  p { margin: 0 0 8px; }
  ul, ol { margin: 4px 0 8px; padding-left: 22px; }
  h1, h2, h3 { margin: 12px 0 6px; }
  img { max-width: 100%; height: auto; }
  a { color: ${Colors.primary}; }
  blockquote { border-left: 3px solid ${Colors.primary}; margin: 8px 0; padding-left: 10px; opacity: 0.85; }
</style>
</head>
<body>
<div id="content">${html}</div>
<script>
(function () {
  function report() {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height: document.body.scrollHeight }));
    }
  }
  report();
  window.addEventListener('load', function () { setTimeout(report, 50); });
})();
</script>
</body>
</html>`;

/**
 * Renders trusted rich HTML (tiptap note content, shared notes) at its natural
 * height inside scrollable native layouts — the HTML analogue of MathMarkdown.
 */
export const HtmlContent: React.FC<HtmlContentProps> = ({ html }) => {
  const wrapped = useMemo(() => wrap(html), [html]);
  return <AutoHeightWebView html={wrapped} />;
};
