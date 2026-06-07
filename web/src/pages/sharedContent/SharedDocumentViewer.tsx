import React, { useState, useEffect, useRef } from 'react';
import { FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { renderAsync } from 'docx-preview';
import { Document as PdfDocument, Page as PdfPage, pdfjs } from 'react-pdf';
import { getApiUrl } from '../../utils/env';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const API_URL = getApiUrl();

/** Public document preview (PDF / DOCX / TXT / MD) — no auth required. */
export const SharedDocumentViewer: React.FC<{ token: string; fileType: string }> = ({ token, fileType }) => {
  const fileUrl = `${API_URL}/api/share/${token}/file`;
  const [collapsed, setCollapsed] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const measureRef = useRef<HTMLDivElement>(null);
  const docxRef = useRef<HTMLDivElement>(null);

  const isPdf = fileType.includes('pdf');
  const isDocx = fileType.includes('wordprocessingml') || fileType.includes('docx');
  const isTxt = fileType.includes('text/plain');
  const isMd = fileType.includes('markdown');

  useEffect(() => {
    if (!measureRef.current) return;
    const observer = new ResizeObserver(entries => {
      if (entries[0]) setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(measureRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isTxt || isMd) {
      fetch(fileUrl).then(r => r.text()).then(setTextContent).catch(() => setTextContent('Failed to load content.'));
    } else if (isDocx && docxRef.current) {
      fetch(fileUrl)
        .then(r => r.arrayBuffer())
        .then(buf => { if (docxRef.current) renderAsync(buf, docxRef.current); })
        .catch(() => { if (docxRef.current) docxRef.current.innerHTML = '<p class="text-red-500 p-4">Failed to load document.</p>'; });
    }
  }, [fileUrl, isTxt, isMd, isDocx]);

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-color)]">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <FileText size={13} className="text-primary" />
        </div>
        <span className="text-xs font-semibold text-text-muted flex-1">Document Preview</span>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="rounded-lg p-1 text-text-muted hover:text-text-main hover:bg-[var(--bg-app)] transition-colors"
        >
          {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
      </div>

      {!collapsed && (
        <div ref={measureRef} className="max-h-[600px] overflow-y-auto bg-zinc-100 p-3">
          {isPdf && (
            <div className="flex flex-col items-center gap-3">
              <PdfDocument
                file={fileUrl}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading={<div className="flex flex-col items-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /><p className="mt-3 text-sm text-zinc-500">Loading PDF...</p></div>}
                error={<div className="rounded-xl bg-red-50 p-6 text-center text-red-600 border border-red-100"><p className="font-semibold">Failed to load PDF</p></div>}
              >
                {numPages && Array.from({ length: numPages }, (_, i) => (
                  <PdfPage
                    key={i + 1}
                    pageNumber={i + 1}
                    width={containerWidth ? Math.max(containerWidth - 24, 200) : 300}
                    renderAnnotationLayer
                    renderTextLayer
                    className="mb-3 shadow-sm"
                  />
                ))}
              </PdfDocument>
            </div>
          )}

          {isDocx && (
            <>
              <style>{`.docx-wrapper{background:transparent!important;padding:0!important}.docx-wrapper>section.docx{margin-bottom:12px!important;box-shadow:0 1px 3px rgba(0,0,0,0.08)!important;max-width:100%!important;overflow-x:hidden!important}`}</style>
              <div ref={docxRef} className="mx-auto max-w-3xl overflow-x-hidden" />
            </>
          )}

          {(isTxt || isMd) && (
            <div className="mx-auto max-w-3xl rounded-lg bg-white p-5 shadow-sm prose prose-sm prose-zinc">
              {isTxt ? (
                <pre className="whitespace-pre-wrap font-sans break-words text-sm">{textContent ?? ''}</pre>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{textContent ?? ''}</ReactMarkdown>
              )}
            </div>
          )}

          {!isPdf && !isDocx && !isTxt && !isMd && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileText size={32} className="text-zinc-300 mb-3" />
              <p className="text-sm text-zinc-500">Preview not available for this file type.</p>
              <a
                href={fileUrl}
                download
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition-opacity"
              >
                Download File
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
