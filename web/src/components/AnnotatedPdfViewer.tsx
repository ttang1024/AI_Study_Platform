import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { AnnotationToolbar } from './AnnotationToolbar';
import { AnnotationsSidebar } from './AnnotationsSidebar';
import annotationsService, { type DocumentAnnotation } from '../services/annotationsService';
import { ChevronLeft, ChevronRight, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { parseRects, type NormRect } from '@core/utils/pdfRects';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  documentId: string;
  pdfUrl: string;
  httpHeaders?: Record<string, string>;
}


interface ToolbarState {
  visible: boolean;
  text: string;
  rects: NormRect[];
  position: { x: number; y: number };
}

export const AnnotatedPdfViewer: React.FC<Props> = ({ documentId, pdfUrl, httpHeaders }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [annotations, setAnnotations] = useState<DocumentAnnotation[]>([]);
  const [toolbar, setToolbar] = useState<ToolbarState>({ visible: false, text: '', rects: [], position: { x: 0, y: 0 } });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const pageWrapperRef = useRef<HTMLDivElement>(null);

  // Memoize the file source so react-pdf doesn't reload the PDF on every render.
  const fileSource = useMemo(
    () => (httpHeaders ? { url: pdfUrl, httpHeaders } : pdfUrl),
    [pdfUrl, httpHeaders]
  );

  // Load annotations on mount
  useEffect(() => {
    annotationsService.getByDocument(documentId)
      .then((res) => setAnnotations(res.data?.data ?? []))
      .catch(() => {});
  }, [documentId]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const text = selection.toString().trim();
    if (!text) return;

    const wrapper = pageWrapperRef.current;
    if (!wrapper) return;
    const pageRect = wrapper.getBoundingClientRect();
    if (pageRect.width === 0 || pageRect.height === 0) return;

    const range = selection.getRangeAt(0);
    // Convert each client rect of the selection into page-normalized coords.
    const rects: NormRect[] = Array.from(range.getClientRects())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({
        x: (r.left - pageRect.left) / pageRect.width,
        y: (r.top - pageRect.top) / pageRect.height,
        w: r.width / pageRect.width,
        h: r.height / pageRect.height,
      }))
      // Keep only rects that fall on the rendered page.
      .filter((r) => r.x >= -0.02 && r.x <= 1.02 && r.y >= -0.02 && r.y <= 1.02);

    const bounds = range.getBoundingClientRect();
    setToolbar({
      visible: true,
      text,
      rects,
      position: {
        x: bounds.left + bounds.width / 2,
        y: bounds.bottom + 8,
      },
    });
  }, []);

  const closeToolbar = useCallback(() => {
    setToolbar((t) => ({ ...t, visible: false }));
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleSaveAnnotation = async (color: string, note?: string) => {
    if (!toolbar.text) return;
    try {
      const res = await annotationsService.create(documentId, {
        highlightedText: toolbar.text,
        note,
        color,
        pageNumber,
        rectJson: JSON.stringify(toolbar.rects),
      });
      if (res.data?.data) {
        setAnnotations((prev) => [...prev, res.data.data]);
      }
    } catch {
      // ignore
    }
    closeToolbar();
  };

  const handleCreateFlashcard = async () => {
    // Save annotation first, then create flashcard from it
    if (!toolbar.text) return;
    try {
      const res = await annotationsService.create(documentId, {
        highlightedText: toolbar.text,
        color: '#FFFF00',
        pageNumber,
        rectJson: JSON.stringify(toolbar.rects),
      });
      if (res.data?.data) {
        setAnnotations((prev) => [...prev, res.data.data]);
        await annotationsService.createFlashcard(res.data.data.documentAnnotationId);
      }
    } catch {
      // ignore
    }
    closeToolbar();
  };

  const handleDeleteAnnotation = async (id: string) => {
    try {
      await annotationsService.delete(id);
      setAnnotations((prev) => prev.filter((a) => a.documentAnnotationId !== id));
    } catch {
      // ignore
    }
  };

  // Highlights to paint on the page currently in view.
  const pageHighlights = useMemo(
    () => annotations.filter((a) => a.pageNumber === pageNumber),
    [annotations, pageNumber]
  );

  return (
    <div className="flex h-full overflow-hidden rounded-xl border border-gray-200">
      {/* PDF area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-gray-50 shrink-0">
          <button
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs text-gray-600">
            Page {pageNumber} of {numPages}
          </span>
          <button
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
            className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          <div className="flex-1" />
          <span className="text-xs text-gray-400">Select text to annotate</span>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1 rounded text-gray-500 hover:bg-gray-200 transition-colors"
            title={sidebarOpen ? 'Hide annotations' : 'Show annotations'}
          >
            {sidebarOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
        </div>

        {/* PDF canvas */}
        <div
          className="flex-1 overflow-auto bg-gray-100 flex justify-center p-4"
          onMouseUp={handleMouseUp}
        >
          {loading && (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              Loading PDF...
            </div>
          )}
          <Document
            file={fileSource}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={() => setLoading(false)}
            className="shadow-lg h-fit"
          >
            <div ref={pageWrapperRef} className="relative inline-block">
              <Page
                pageNumber={pageNumber}
                renderTextLayer
                renderAnnotationLayer
                className="bg-white"
              />
              {/* Highlight overlays — positioned over the rendered page */}
              {pageHighlights.map((a) =>
                parseRects(a.rectJson).map((r, i) => (
                  <div
                    key={`${a.documentAnnotationId}-${i}`}
                    title={a.note || a.highlightedText}
                    style={{
                      position: 'absolute',
                      left: `${r.x * 100}%`,
                      top: `${r.y * 100}%`,
                      width: `${r.w * 100}%`,
                      height: `${r.h * 100}%`,
                      backgroundColor: a.color,
                      opacity: 0.4,
                      mixBlendMode: 'multiply',
                      pointerEvents: 'none',
                      borderRadius: 2,
                    }}
                  />
                ))
              )}
            </div>
          </Document>
        </div>
      </div>

      {/* Annotations sidebar */}
      {sidebarOpen && (
        <div className="w-64 shrink-0 border-l border-gray-200 bg-white overflow-hidden flex flex-col">
          <AnnotationsSidebar
            annotations={annotations}
            onDelete={handleDeleteAnnotation}
          />
        </div>
      )}

      {/* Floating toolbar */}
      {toolbar.visible && (
        <AnnotationToolbar
          selectedText={toolbar.text}
          position={toolbar.position}
          onSave={handleSaveAnnotation}
          onCreateFlashcard={handleCreateFlashcard}
          onClose={closeToolbar}
        />
      )}
    </div>
  );
};
