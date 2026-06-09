import React, { useState, useEffect, useRef, useMemo } from 'react';
import { renderAsync } from 'docx-preview';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useStudy } from '../../context/StudyContext';
import { TextSelectionToolbar } from './TextSelectionToolbar';
import { Loader2 } from 'lucide-react';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Stable references for react-markdown. Defined at module scope so their identity
// never changes across renders — otherwise react-markdown unmounts/remounts the
// whole markdown subtree on each render, which wipes the user's text selection.
const MARKDOWN_REMARK_PLUGINS = [remarkGfm, remarkMath];
const MARKDOWN_REHYPE_PLUGINS = [rehypeKatex];
const MARKDOWN_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h1: ({ children }) => <h1 className="mt-8 mb-4 text-3xl font-bold text-zinc-900 border-b border-zinc-200 pb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-7 mb-3 text-2xl font-bold text-zinc-800 border-b border-zinc-100 pb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-6 mb-2 text-xl font-semibold text-zinc-800">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-5 mb-2 text-lg font-semibold text-zinc-700">{children}</h4>,
  h5: ({ children }) => <h5 className="mt-4 mb-1 text-base font-semibold text-zinc-700">{children}</h5>,
  h6: ({ children }) => <h6 className="mt-4 mb-1 text-sm font-semibold text-zinc-600">{children}</h6>,
  p: ({ children }) => <p className="my-3 leading-7 text-zinc-700">{children}</p>,
  ul: ({ children }) => <ul className="my-3 ml-6 list-disc space-y-1 text-zinc-700">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 ml-6 list-decimal space-y-1 text-zinc-700">{children}</ol>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-zinc-300 bg-zinc-50 pl-4 pr-2 py-2 italic text-zinc-600 rounded-r-lg">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    const isBlock = Boolean(className);
    return isBlock
      ? <code className="block">{children}</code>
      : <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[0.875em] font-mono text-zinc-800 border border-zinc-200">{children}</code>;
  },
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-xl bg-zinc-900 p-4 text-sm text-zinc-100 leading-relaxed">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-teal-600 underline underline-offset-2 hover:text-teal-800 transition-colors">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-zinc-900">{children}</strong>,
  em: ({ children }) => <em className="italic text-zinc-700">{children}</em>,
  hr: () => <hr className="my-6 border-zinc-200" />,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-zinc-200">
      <table className="w-full text-sm text-zinc-700">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-zinc-50 text-zinc-800 font-semibold">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-zinc-100">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-zinc-50 transition-colors">{children}</tr>,
  th: ({ children }) => <th className="px-4 py-2 text-left font-semibold border-b border-zinc-200">{children}</th>,
  td: ({ children }) => <td className="px-4 py-2">{children}</td>,
  img: ({ src, alt }) => (
    <img src={src} alt={alt} className="my-4 max-w-full rounded-lg border border-zinc-200 shadow-sm" />
  ),
};

interface DocumentViewerProps {
  fileUrl: string;
  fileType: 'pdf' | 'docx' | 'txt' | 'md';
  httpHeaders?: Record<string, string>;
  onAddNote?: () => void;
  onAddNoteText?: (text: string) => void;
  onAskAI?: (text: string) => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ fileUrl, fileType, httpHeaders, onAddNote, onAddNoteText, onAskAI }) => {
  const isUrlValid = fileUrl && fileUrl !== '#';
  const [content, setContent] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ x: number; y: number; text: string } | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const measureRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!measureRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(measureRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isUrlValid) return;

    if (fileType === 'txt' || fileType === 'md') {
      fetch(fileUrl, { headers: httpHeaders })
        .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.text();
        })
        .then(setContent)
        .catch(err => {
          console.error('Failed to fetch text file:', err);
          setContent('Error: Failed to load text content. This might be due to cross-origin restrictions.');
        });
    } else if (fileType === 'docx') {
      fetch(fileUrl, { headers: httpHeaders })
        .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.arrayBuffer();
        })
        .then(buffer => {
          if (containerRef.current) {
            renderAsync(buffer, containerRef.current);
          }
        })
        .catch(err => {
          console.error('Failed to fetch docx file:', err);
          if (containerRef.current) {
            containerRef.current.innerHTML = `
              <div class="rounded-xl bg-red-50 p-8 text-center text-red-600 border border-red-100">
                <p class="font-semibold">Failed to load DOCX</p>
              </div>
            `;
          }
        });
    }
  }, [fileUrl, fileType, isUrlValid]);

  const pdfFile = useMemo(
    () => httpHeaders ? { url: fileUrl, httpHeaders } : fileUrl,
    [fileUrl, httpHeaders]
  );

  const handleMouseUp = () => {
    const activeSelection = window.getSelection();
    if (activeSelection && activeSelection.toString().trim().length > 0) {
      const range = activeSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelection({
        x: rect.left + rect.width / 2,
        y: rect.top - 40,
        text: activeSelection.toString().trim()
      });
    } else {
      setSelection(null);
    }
  };

  return (
    <div ref={measureRef} className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-zinc-100 p-2 sm:p-4" onMouseUp={handleMouseUp}>
      {/* Override docx-preview default styles */}
      <style>{`
        .docx-wrapper { background: transparent !important; padding: 0 !important; }
        .docx-wrapper > section.docx { margin-bottom: 12px !important; box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important; max-width: 100% !important; overflow-x: hidden !important; }
        .docx-wrapper section.docx > * { max-width: 100% !important; }
      `}</style>

      {fileType === 'docx' ? (
        /* DOCX: render directly into containerRef, no prose wrapper needed */
        <div
          ref={containerRef}
          className="mx-auto max-w-4xl overflow-x-hidden"
        >
          {!isUrlValid && (
            <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-500">
              <Loader2 className="h-8 w-8 mb-4 animate-pulse" />
              <p>No valid document URL provided.</p>
            </div>
          )}
        </div>
      ) : (
        <div
          ref={containerRef}
          className="mx-auto max-w-4xl rounded-lg bg-white p-4 sm:p-6 shadow-sm min-h-full prose prose-zinc"
        >
          {!isUrlValid && (
            <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-500">
              <Loader2 className="h-8 w-8 mb-4 animate-pulse" />
              <p>No valid document URL provided.</p>
            </div>
          )}

          {isUrlValid && fileType === 'txt' && <pre className="whitespace-pre-wrap font-sans break-words">{content}</pre>}

          {isUrlValid && fileType === 'md' && (
            <ReactMarkdown
              remarkPlugins={MARKDOWN_REMARK_PLUGINS}
              rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
              components={MARKDOWN_COMPONENTS}
            >
              {content || ''}
            </ReactMarkdown>
          )}

          {isUrlValid && fileType === 'pdf' && (
            <div className="flex flex-col items-center gap-4">
              <Document
                file={pdfFile}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading={
                  <div className="flex flex-col items-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="mt-4 text-sm text-zinc-500">Loading PDF...</p>
                  </div>
                }
                error={
                  <div className="rounded-xl bg-red-50 p-8 text-center text-red-600 border border-red-100">
                    <p className="font-semibold">Failed to load PDF</p>
                  </div>
                }
              >
                {numPages && Array.from({ length: numPages }, (_, i) => (
                  <Page
                    key={i + 1}
                    pageNumber={i + 1}
                    width={containerWidth ? Math.max(containerWidth - 16, 200) : 300}
                    renderAnnotationLayer={true}
                    renderTextLayer={true}
                    className="mb-4 shadow-sm"
                  />
                ))}
              </Document>
            </div>
          )}
        </div>
      )}

      {selection && (
        <TextSelectionToolbar
          x={selection.x}
          y={selection.y}
          selectedText={selection.text}
          onClose={() => setSelection(null)}
          onAddNote={onAddNote}
          onAddNoteText={onAddNoteText}
          onAskAI={onAskAI}
        />
      )}
    </div>
  );
};
