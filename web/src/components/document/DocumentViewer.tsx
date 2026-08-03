import React, { useState, useEffect, useRef, useMemo } from 'react';
import { renderAsync } from 'docx-preview';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import ReactMarkdown from 'react-markdown';
import { MARKDOWN_COMPONENTS, MARKDOWN_REHYPE_PLUGINS, MARKDOWN_REMARK_PLUGINS } from './markdownComponents';
import { TextSelectionToolbar } from './TextSelectionToolbar';
import { CodeFileViewer } from './CodeFileViewer';
import { TableFileViewer } from './TableFileViewer';
import { NotebookViewer } from './NotebookViewer';
import { SubtitleViewer } from './SubtitleViewer';
import { HtmlFileViewer } from './HtmlFileViewer';
import { prettyPrintData, dataCaption } from '../../utils/dataFile';
import type { DocumentViewerKind } from '@core/services/documentService';
import { Loader2 } from 'lucide-react';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;


// Kinds whose renderer works from the file's text, whether that text is the
// original bytes (code, captions, CSV…) or the server-extracted plain text.
const TEXT_KINDS: DocumentViewerKind[] = ['text', 'md', 'code', 'data', 'table', 'notebook', 'subtitle', 'html'];

interface DocumentViewerProps {
  fileUrl: string;
  fileType: DocumentViewerKind;
  /** Original upload name; its extension selects the highlighter and parsers. */
  fileName?: string;
  httpHeaders?: Record<string, string>;
  onAddNote?: () => void;
  onAddNoteText?: (text: string) => void;
  onAskAI?: (text: string) => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ fileUrl, fileType, fileName = '', httpHeaders, onAddNote, onAddNoteText, onAskAI }) => {
  const isUrlValid = fileUrl && fileUrl !== '#';
  const [content, setContent] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
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

    if (TEXT_KINDS.includes(fileType)) {
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
    } else if (fileType === 'image') {
      let objectUrl: string | null = null;
      fetch(fileUrl, { headers: httpHeaders })
        .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.blob();
        })
        .then(blob => {
          objectUrl = URL.createObjectURL(blob);
          setImageUrl(objectUrl);
        })
        .catch(err => {
          console.error('Failed to fetch image file:', err);
          setImageUrl(null);
        });
      return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
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

          {isUrlValid && TEXT_KINDS.includes(fileType) && fileType !== 'md' && (
            content === null
              ? (
                <div className="flex flex-col items-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="mt-4 text-sm text-zinc-500">Extracting content...</p>
                </div>
              )
              : fileType === 'code'
                ? <CodeFileViewer code={content} fileName={fileName} />
              : fileType === 'data'
                ? <CodeFileViewer
                    code={prettyPrintData(content, fileName)}
                    fileName={fileName}
                    caption={dataCaption(content, fileName)}
                  />
              : fileType === 'table'
                ? <TableFileViewer text={content} fileName={fileName} />
              : fileType === 'notebook'
                ? <NotebookViewer text={content} fileName={fileName} />
              : fileType === 'subtitle'
                ? <SubtitleViewer text={content} fileName={fileName} />
              : fileType === 'html'
                ? <HtmlFileViewer html={content} fileName={fileName} />
                : <pre className="whitespace-pre-wrap font-sans break-words">{content}</pre>
          )}

          {isUrlValid && fileType === 'image' && (
            imageUrl
              ? <img src={imageUrl} alt="Document" className="mx-auto max-w-full rounded-lg" />
              : (
                <div className="flex flex-col items-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="mt-4 text-sm text-zinc-500">Loading image...</p>
                </div>
              )
          )}

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
