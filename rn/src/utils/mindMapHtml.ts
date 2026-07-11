import { D3_JS_SOURCE } from '@/vendor/markmap/d3';
import { MARKMAP_LIB_JS_SOURCE } from '@/vendor/markmap/markmapLib';
import { MARKMAP_VIEW_JS_SOURCE } from '@/vendor/markmap/markmapView';

// Renders the same markmap-lib/markmap-view libraries the web app uses, inside a
// WebView. Mind map nodes are laid out via <foreignObject> (needed for markmap's
// text wrapping), which react-native-svg can't render — a WebView is the only
// option that reuses the real library instead of reimplementing tree layout.
export function buildMindMapHtml(markdown: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #ffffff; overflow: hidden; }
  svg#markmap { width: 100vw; height: 100vh; display: block; }
</style>
</head>
<body>
<svg id="markmap"></svg>
<script>${D3_JS_SOURCE}</script>
<script>${MARKMAP_LIB_JS_SOURCE}</script>
<script>${MARKMAP_VIEW_JS_SOURCE}</script>
<script>
(function () {
  function post(payload) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }
  try {
    var style = document.createElement('style');
    style.textContent = markmap.globalCSS;
    document.head.appendChild(style);

    var markdown = ${JSON.stringify(markdown)};
    var transformer = new markmap.Transformer();
    var result = transformer.transform(markdown);
    window.mm = markmap.Markmap.create('#markmap', {}, result.root);

    window.mmFit = function () { window.mm && window.mm.fit(); };
    // markmap's own rescale() drifts off-center on repeated zoom steps (known bug);
    // anchor explicitly at the viewport midpoint instead, mirroring the web app's fix.
    window.mmZoomBy = function (factor) {
      if (!window.mm) return;
      var svg = window.mm.svg;
      var zoom = window.mm.zoom;
      var node = svg.node();
      var rect = node.getBoundingClientRect();
      zoom.scaleBy(svg, factor, [rect.width / 2, rect.height / 2]);
    };

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { window.mmFit(); post({ type: 'ready' }); });
    });
  } catch (e) {
    post({ type: 'error', message: String(e && e.message || e) });
  }
})();
</script>
</body>
</html>`;
}
