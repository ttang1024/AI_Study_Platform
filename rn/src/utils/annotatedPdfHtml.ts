// pdf.js viewer HTML for the annotation WebView. Renders one page at a time
// (canvas + selectable text layer), paints highlight overlays from normalized
// page rects (same 0..1 rectJson coordinate space as web's AnnotatedPdfViewer),
// and reports text selections back to RN as normalized rects. pdf.js comes from
// the cdnjs CDN (same trade-off as mathMarkdownHtml.ts: the PDF itself required
// a network fetch, so the CDN adds no new offline failure mode). The PDF bytes
// are injected from RN as base64 — the WebView never fetches the blob URL
// itself, which sidesteps CORS on presigned storage URLs.

const PDFJS_VERSION = '3.11.174';

export function buildAnnotatedPdfHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; background: #f4f4f5; }
  #wrap { position: relative; margin: 0 auto; }
  #page-canvas { display: block; }
  /* Minimal pdf.js text-layer styles: invisible selectable text over the canvas. */
  .textLayer {
    position: absolute; inset: 0; overflow: hidden;
    line-height: 1; text-size-adjust: none; forced-color-adjust: none;
    transform-origin: 0 0; caret-color: CanvasText;
  }
  .textLayer span, .textLayer br {
    color: transparent; position: absolute; white-space: pre;
    cursor: text; transform-origin: 0% 0%;
  }
  .textLayer ::selection { background: rgba(0, 120, 255, 0.35); }
  .hl { position: absolute; opacity: 0.4; mix-blend-mode: multiply; border-radius: 2px; pointer-events: none; }
</style>
</head>
<body>
<div id="wrap">
  <canvas id="page-canvas"></canvas>
  <div id="text-layer" class="textLayer"></div>
  <div id="hl-layer"></div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js"></script>
<script>
(function () {
  function post(payload) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }

  if (!window.pdfjsLib) { post({ type: 'error', message: 'pdf.js failed to load' }); return; }
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js';

  var pdfDoc = null;
  var currentPage = 1;
  var rendering = false;
  var highlights = [];

  function base64ToBytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function paintHighlights() {
    var layer = document.getElementById('hl-layer');
    layer.innerHTML = '';
    var wrap = document.getElementById('wrap');
    highlights.forEach(function (h) {
      (h.rects || []).forEach(function (r) {
        var div = document.createElement('div');
        div.className = 'hl';
        div.style.left = (r.x * 100) + '%';
        div.style.top = (r.y * 100) + '%';
        div.style.width = (r.w * 100) + '%';
        div.style.height = (r.h * 100) + '%';
        div.style.backgroundColor = h.color;
        layer.appendChild(div);
      });
    });
    layer.style.position = 'absolute';
    layer.style.inset = '0';
  }

  function renderPage(num) {
    if (!pdfDoc || rendering) return;
    rendering = true;
    pdfDoc.getPage(num).then(function (page) {
      var containerWidth = document.documentElement.clientWidth;
      var baseViewport = page.getViewport({ scale: 1 });
      var scale = containerWidth / baseViewport.width;
      var viewport = page.getViewport({ scale: scale });
      var dpr = window.devicePixelRatio || 1;

      var wrap = document.getElementById('wrap');
      wrap.style.width = viewport.width + 'px';
      wrap.style.height = viewport.height + 'px';

      var canvas = document.getElementById('page-canvas');
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';
      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var renderTask = page.render({ canvasContext: ctx, viewport: viewport });
      var textPromise = page.getTextContent().then(function (textContent) {
        var textLayer = document.getElementById('text-layer');
        textLayer.innerHTML = '';
        textLayer.style.width = viewport.width + 'px';
        textLayer.style.height = viewport.height + 'px';
        return pdfjsLib.renderTextLayer({
          textContentSource: textContent,
          container: textLayer,
          viewport: viewport,
          textDivs: [],
        }).promise;
      });

      Promise.all([renderTask.promise, textPromise]).then(function () {
        currentPage = num;
        rendering = false;
        paintHighlights();
        post({ type: 'page-rendered', page: num, height: document.body.scrollHeight });
      }).catch(function (e) {
        rendering = false;
        post({ type: 'error', message: String(e && e.message || e) });
      });
    }, function (e) {
      rendering = false;
      post({ type: 'error', message: String(e && e.message || e) });
    });
  }

  // ── RN-facing API ──────────────────────────────────────────────────────────
  window.__loadPdf = function (b64) {
    try {
      pdfjsLib.getDocument({ data: base64ToBytes(b64) }).promise.then(function (doc) {
        pdfDoc = doc;
        post({ type: 'loaded', numPages: doc.numPages });
        renderPage(1);
      }, function (e) {
        post({ type: 'error', message: String(e && e.message || e) });
      });
    } catch (e) {
      post({ type: 'error', message: String(e && e.message || e) });
    }
  };

  window.__goToPage = function (num) { renderPage(num); };

  window.__setHighlights = function (list) {
    highlights = list || [];
    paintHighlights();
  };

  window.__clearSelection = function () {
    var sel = window.getSelection();
    if (sel) sel.removeAllRanges();
  };

  // ── Selection → normalized rects ──────────────────────────────────────────
  var selTimer = null;
  document.addEventListener('selectionchange', function () {
    clearTimeout(selTimer);
    selTimer = setTimeout(function () {
      var sel = window.getSelection();
      var text = sel ? String(sel).trim() : '';
      if (!sel || sel.rangeCount === 0 || !text) {
        post({ type: 'selection-clear' });
        return;
      }
      var wrap = document.getElementById('wrap');
      var pageRect = wrap.getBoundingClientRect();
      if (pageRect.width === 0 || pageRect.height === 0) return;
      var range = sel.getRangeAt(0);
      var rects = Array.prototype.slice.call(range.getClientRects())
        .filter(function (r) { return r.width > 0 && r.height > 0; })
        .map(function (r) {
          return {
            x: (r.left - pageRect.left) / pageRect.width,
            y: (r.top - pageRect.top) / pageRect.height,
            w: r.width / pageRect.width,
            h: r.height / pageRect.height,
          };
        })
        .filter(function (r) { return r.x >= -0.02 && r.x <= 1.02 && r.y >= -0.02 && r.y <= 1.02; });
      if (rects.length === 0) { post({ type: 'selection-clear' }); return; }
      post({ type: 'selection', text: text, rects: rects });
    }, 300);
  });

  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
}
