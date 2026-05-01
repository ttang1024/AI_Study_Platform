import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import {
  Maximize2, Minimize2, RotateCcw, Loader2,
  Download, Image, FileDown, FileText,
  ZoomIn, ZoomOut,
  Brain,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { cn } from '../../utils/cn';
import { useStudy } from '../../context/StudyContext';
import { documentService } from '../../services/documentService';
import { getApiErrorCode } from '../../utils/apiError';
import { EmptyGenerationState, GenerationFailedState } from '../common/GenerationStates';

// ─── Conversion: XMindMark text → Markdown ───────────────────────────────────

interface TreeNode {
  title: string;
  children?: TreeNode[];
}

function legacyJsonToTree(text: string): TreeNode | null {
  try {
    return JSON.parse(text) as TreeNode;
  } catch {
    return null;
  }
}

function treeNodeToMarkdown(node: TreeNode, depth = 0): string {
  if (depth === 0) {
    const childLines = (node.children ?? []).map(c => treeNodeToMarkdown(c, 1)).join('\n');
    return `# ${node.title}${childLines ? '\n' + childLines : ''}`;
  }
  const indent = '  '.repeat(depth - 1);
  const line = `${indent}- ${node.title}`;
  const childLines = (node.children ?? []).map(c => treeNodeToMarkdown(c, depth + 1)).join('\n');
  return childLines ? `${line}\n${childLines}` : line;
}

function xmindMarkToMarkdown(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('{')) {
    const tree = legacyJsonToTree(trimmed);
    if (tree) return treeNodeToMarkdown(tree);
  }

  const lines = trimmed.split('\n').map(l => l.replace(/\t/g, '    '));
  const out: string[] = [];
  let rootFound = false;

  for (const line of lines) {
    if (!line.trim()) continue;
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)/);
    if (!rootFound && !bulletMatch) {
      out.push(`# ${line.trim()}`);
      rootFound = true;
    } else if (bulletMatch) {
      rootFound = true;
      const depth = Math.floor(bulletMatch[1].length / 4);
      const title = bulletMatch[2].replace(/\s*\[[^\]]+\]/g, '').trim();
      out.push('  '.repeat(depth) + `- ${title}`);
    }
  }

  return out.join('\n');
}

// ─── Markmap renderer ─────────────────────────────────────────────────────────

const transformer = new Transformer();

function MarkmapRenderer({
  text,
  mmRef,
}: {
  text: string;
  mmRef: React.MutableRefObject<Markmap | null>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Keep the latest transformed data so we can (re)create markmap when the tab becomes visible
  const dataRef = useRef<any>(null);
  const isHiddenRef = useRef(true);

  // Transform text → data; if already visible, push update + refit
  useEffect(() => {
    const markdown = xmindMarkToMarkdown(text);
    const { root } = transformer.transform(markdown);
    dataRef.current = root;

    if (mmRef.current && !isHiddenRef.current) {
      mmRef.current.setData(root);
      requestAnimationFrame(() => mmRef.current?.fit());
    }
  }, [text]);

  // Create / destroy markmap based on SVG visibility.
  // We MUST recreate (not just fit) each time the SVG goes from 0×0 → real dimensions,
  // because Markmap.create() bakes the D3 zoom extent from the SVG size at creation time.
  // A stale 0×0 extent causes fit() to use the wrong viewport centre and rescale() to
  // zoom around (0,0) instead of the midpoint.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;

      if (width > 0 && height > 0 && isHiddenRef.current) {
        // Hidden → visible: (re)create with correct dimensions
        isHiddenRef.current = false;
        if (mmRef.current) { mmRef.current.destroy(); mmRef.current = null; }
        if (dataRef.current) {
          mmRef.current = Markmap.create(svg, {}, dataRef.current);
        }
        // Double-rAF: first frame commits the creation paint, second reads final layout
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            mmRef.current?.fit();
            svg.style.opacity = '1';
          })
        );
      } else if ((width === 0 || height === 0) && !isHiddenRef.current) {
        // Visible → hidden: tear down so next show starts with a fresh instance
        isHiddenRef.current = true;
        svg.style.opacity = '0';
        if (mmRef.current) { mmRef.current.destroy(); mmRef.current = null; }
      } else if (width > 0 && height > 0 && !isHiddenRef.current) {
        // Already visible but dimensions changed (fullscreen toggle, window resize) → refit.
        // markmap's own ResizeObserver only calls renderData(), never fit(), so we must do it.
        // fit() is idempotent and cancels any in-progress transition, so rapid fires are safe.
        requestAnimationFrame(() => mmRef.current?.fit());
      }
    });

    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  // Final cleanup on unmount
  useEffect(() => () => {
    if (mmRef.current) { mmRef.current.destroy(); mmRef.current = null; }
  }, []);

  // Start invisible; revealed only after fit() confirms correct centering
  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      style={{ opacity: 0, transition: 'opacity 0.15s ease' }}
    />
  );
}

// ─── Shared control button ────────────────────────────────────────────────────

const CtrlBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  className,
  children,
  ...props
}) => (
  <button
    {...props}
    className={cn(
      'flex items-center justify-center w-8 h-8 rounded-xl text-zinc-500',
      'hover:bg-[var(--primary)] hover:text-white transition-all duration-200',
      className,
    )}
  >
    {children}
  </button>
);

const Divider = () => <div className="h-px bg-zinc-100 mx-1 my-0.5" />;

// ─── Component ────────────────────────────────────────────────────────────────

interface MindMapViewerProps {
  mindMapText?: string | null;
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  streamingText?: string | null;
  title?: string;
  externalError?: string | null;
}

export const MindMapViewer: React.FC<MindMapViewerProps> = ({
  mindMapText: propMindMapText,
  onGenerate: propOnGenerate,
  isGenerating: propIsGenerating,
  streamingText: propStreamingText,
  title: propTitle,
  externalError,
}) => {
  const { currentDocument, setCurrentDocument, updateDocumentInList } = useStudy();
  const isExternal = propOnGenerate !== undefined;

  const [isGeneratingLocal, setIsGeneratingLocal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localMindMarkText, setLocalMindMarkText] = useState<string | null>(null);
  const [localStreamingText, setLocalStreamingText] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mmRef = useRef<Markmap | null>(null);
  const streamingAccumRef = useRef('');

  useEffect(() => {
    if (!isExternal && currentDocument?.mindMapText) {
      setLocalMindMarkText(currentDocument.mindMapText);
    }
  }, [currentDocument?.mindMapText, isExternal]);

  useEffect(() => {
    if (!isExternal) setLocalMindMarkText(null);
  }, [currentDocument?.id, isExternal]);

  const activeStreamingText = isExternal ? propStreamingText ?? null : localStreamingText;

  const activeMindMarkText = activeStreamingText
    || (isExternal ? propMindMapText ?? null : localMindMarkText || currentDocument?.mindMapText || null);

  const isGenerating = isExternal ? (propIsGenerating ?? false) : isGeneratingLocal;
  const activeError = isExternal ? externalError : localError;
  const downloadName = propTitle ?? currentDocument?.name ?? 'mindmap';

  const handleGenerate = async () => {
    if (isExternal) {
      await propOnGenerate!();
      return;
    }
    if (!currentDocument) return;
    setIsGeneratingLocal(true);
    setLocalError(null);
    streamingAccumRef.current = '';
    setLocalStreamingText('');
    try {
      await documentService.streamMindMap(
        currentDocument.courseId || '',
        currentDocument.id,
        (chunk) => {
          streamingAccumRef.current += chunk;
          setLocalStreamingText(streamingAccumRef.current);
        },
      );
      const final = streamingAccumRef.current;
      if (final) {
        setLocalMindMarkText(final);
        setCurrentDocument(prev => {
          if (!prev) return prev;
          const updated = { ...prev, mindMapText: final };
          updateDocumentInList(updated);
          return updated;
        });
      }
    } catch (err) {
      console.error('Mind map generation error:', err);
      setLocalError(getApiErrorCode(err));
    } finally {
      setIsGeneratingLocal(false);
      setLocalStreamingText(null);
      streamingAccumRef.current = '';
    }
  };

  const handleFit = useCallback(() => mmRef.current?.fit(), []);

  // markmap's rescale() has a math bug — the formula only keeps the viewport center
  // fixed at t=1, so content drifts on every zoom step.
  // Fix: use D3's zoom.scaleBy() with an explicit [cx, cy] anchor (SVG center).
  const zoomBy = useCallback((factor: number) => {
    const mm = mmRef.current;
    if (!mm) return;
    const { svg, zoom } = mm as any;
    const node = svg.node() as SVGSVGElement;
    const { width, height } = node.getBoundingClientRect();
    zoom.scaleBy(svg, factor, [width / 2, height / 2]);
  }, []);

  const handleZoomIn = useCallback(() => zoomBy(1.25), [zoomBy]);
  const handleZoomOut = useCallback(() => zoomBy(0.8), [zoomBy]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!showDownloadMenu) return;
    const handler = () => setShowDownloadMenu(false);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDownloadMenu]);

  const downloadAsImage = useCallback(async () => {
    setShowDownloadMenu(false);
    const el = containerRef.current;
    if (!el) return;
    const dataUrl = await toPng(el, { backgroundColor: '#ffffff', pixelRatio: 2 });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${downloadName}.png`;
    a.click();
  }, [downloadName]);

  const downloadAsPdf = useCallback(async () => {
    setShowDownloadMenu(false);
    const el = containerRef.current;
    if (!el) return;
    const dataUrl = await toPng(el, { backgroundColor: '#ffffff', pixelRatio: 2 });
    const img = new window.Image();
    img.src = dataUrl;
    await new Promise(r => { img.onload = r; });
    const pdf = new jsPDF({
      orientation: img.width > img.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [img.width, img.height],
    });
    pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
    pdf.save(`${downloadName}.pdf`);
  }, [downloadName]);

  const downloadAsXMind = useCallback(async () => {
    setShowDownloadMenu(false);
    if (!activeMindMarkText) return;
    try {
      const { parseXMindMarkToXMindFile } = await import('xmindmark');
      const buffer = await parseXMindMarkToXMindFile(activeMindMarkText);
      const blob = new Blob([buffer], { type: 'application/vnd.xmind.workbook' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${downloadName}.xmind`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('xmind download failed', err);
    }
  }, [activeMindMarkText, downloadName]);

  const downloadAsXMindMark = useCallback(() => {
    setShowDownloadMenu(false);
    if (!activeMindMarkText) return;
    const blob = new Blob([activeMindMarkText], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${downloadName}.xmindmark`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [activeMindMarkText, downloadName]);

  // ─── States ──────────────────────────────────────────────────────────────────

  if (isGenerating && !activeMindMarkText) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-[var(--primary)]" />
        <p className="text-sm text-zinc-500">Generating mind map...</p>
      </div>
    );
  }

  if (activeError && !activeMindMarkText) {
    return (
      <GenerationFailedState message={activeError} onRetry={handleGenerate} />
    );
  }

  if (!activeMindMarkText) {
    return (
      <EmptyGenerationState
        icon={Brain}
        title="No Mind Map Yet"
        description="Generate a visual mind map."
        actionLabel="Generate Mind Map"
        onAction={handleGenerate}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-full w-full bg-white overflow-hidden',
        !isFullscreen && 'rounded-[40px] border border-zinc-100 shadow-inner',
      )}
    >
      <MarkmapRenderer text={activeMindMarkText} mmRef={mmRef} />

      {isGenerating && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-md border border-zinc-100">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--primary)]" />
          <span className="text-xs text-zinc-500">Building mind map...</span>
        </div>
      )}

      {/* Controls — single consolidated panel */}
      <motion.div
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="absolute top-4 right-4 flex flex-col bg-white/90 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-2xl p-1.5 gap-0.5 pointer-events-auto"
      >
        {/* Fit to view */}
        <CtrlBtn onClick={handleFit} title="Fit to view">
          <RotateCcw size={16} />
        </CtrlBtn>

        {/* Zoom in */}
        <CtrlBtn onClick={handleZoomIn} title="Zoom in">
          <ZoomIn size={16} />
        </CtrlBtn>

        {/* Zoom out */}
        <CtrlBtn onClick={handleZoomOut} title="Zoom out">
          <ZoomOut size={16} />
        </CtrlBtn>

        <Divider />

        {/* Fullscreen */}
        <CtrlBtn onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </CtrlBtn>

        <Divider />

        {/* Download */}
        <div className="relative">
          <CtrlBtn onClick={() => setShowDownloadMenu(v => !v)} title="Download">
            <Download size={16} />
          </CtrlBtn>

          <AnimatePresence>
            {showDownloadMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, x: 6 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.92, x: 6 }}
                className="absolute right-full top-0 mr-2 flex flex-col bg-white/95 backdrop-blur-2xl rounded-2xl border border-zinc-100 shadow-2xl overflow-hidden p-1 min-w-[160px]"
              >
                <button
                  onClick={downloadAsImage}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 rounded-xl transition-colors"
                >
                  <Image size={15} className="text-zinc-400" /> Image (PNG)
                </button>
                <button
                  onClick={downloadAsPdf}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 rounded-xl transition-colors"
                >
                  <FileDown size={15} className="text-zinc-400" /> PDF
                </button>
                <button
                  onClick={downloadAsXMind}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 rounded-xl transition-colors"
                >
                  <FileText size={15} className="text-zinc-400" /> XMind File
                </button>
                <button
                  onClick={downloadAsXMindMark}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 rounded-xl transition-colors"
                >
                  <FileText size={15} className="text-zinc-400" /> XMindMark Text
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
