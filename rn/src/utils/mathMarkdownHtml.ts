// Markdown-with-math rendering for WebView. react-native-markdown-display has no
// math support, so content containing TeX delimiters renders in a WebView using
// markdown-it + KaTeX auto-render. Unlike markmap (vendored, JS-only), KaTeX
// depends on ~60 webfont files its CSS loads by relative URL — impractical to
// inline — so these come from the jsDelivr CDN. Content itself only exists after
// a network fetch, so the CDN dependency adds no new offline failure mode; if the
// scripts fail to load anyway, the raw markdown text is shown as a fallback.

const KATEX_VERSION = '0.16.11';
const MARKDOWN_IT_VERSION = '14.1.0';

/** True when the text contains TeX math delimiters ($…$, $$…$$, \( \), \[ \]). */
export const containsTexMath = (text: string): boolean =>
  /\$\$[\s\S]+?\$\$/.test(text)
  || /\\\(|\\\[/.test(text)
  || /(^|[^\\$])\$(?!\s)[^$\n]*[^\\\s$]\$(?!\d)/m.test(text);

export function buildMathMarkdownHtml(markdown: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css" />
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  body {
    font-family: -apple-system, system-ui, sans-serif;
    font-size: 14px; line-height: 1.5; color: #1f2937;
    overflow-wrap: break-word;
  }
  h1 { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #059669; margin: 12px 0 4px; }
  h2 { font-size: 15px; font-weight: 800; margin: 16px 0 4px; }
  h3 { font-size: 13px; font-weight: 700; color: #6b7280; margin: 12px 0 4px; }
  p { margin: 0 0 8px; }
  ul, ol { margin: 4px 0 8px; padding-left: 22px; }
  li { margin-bottom: 3px; }
  code { background: #e4e4e7; border-radius: 4px; padding: 1px 4px; font-size: 0.9em; }
  pre { background: #18181b; color: #f4f4f5; border-radius: 12px; padding: 10px; overflow-x: auto; }
  pre code { background: transparent; padding: 0; }
  blockquote { border-left: 3px solid #059669; margin: 8px 0; padding-left: 10px; opacity: 0.85; }
  table { border-collapse: collapse; font-size: 13px; margin: 8px 0; }
  th, td { border: 1px solid #e4e4e7; padding: 5px 8px; text-align: left; }
  .katex-display { overflow-x: auto; overflow-y: hidden; padding: 2px 0; }
</style>
</head>
<body>
<div id="content"></div>
<script src="https://cdn.jsdelivr.net/npm/markdown-it@${MARKDOWN_IT_VERSION}/dist/markdown-it.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/contrib/auto-render.min.js"></script>
<script>
(function () {
  function post(payload) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }
  function reportHeight() {
    post({ type: 'height', height: document.body.scrollHeight });
  }

  var raw = ${JSON.stringify(markdown)};
  var el = document.getElementById('content');
  try {
    if (typeof markdownit === 'function') {
      el.innerHTML = markdownit({ html: false, linkify: true }).render(raw);
    } else {
      el.textContent = raw;
    }
    if (typeof renderMathInElement === 'function') {
      renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\\\[', right: '\\\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\\\(', right: '\\\\)', display: false },
        ],
        throwOnError: false,
      });
    }
  } catch (e) {
    el.textContent = raw;
  }

  reportHeight();
  // Webfonts shift layout as they arrive; report again once everything settles.
  window.addEventListener('load', function () { setTimeout(reportHeight, 50); });
})();
</script>
</body>
</html>`;
}
