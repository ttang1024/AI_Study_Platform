import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Markmap } from 'markmap-view';
import {
  Maximize2, Minimize2, RotateCcw, Loader2,
  Download, Image, FileDown, FileText,
  ZoomIn, ZoomOut,
  Brain, Pencil, Check, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../utils/cn';
import { useStudy } from '../../context/StudyContext';
import { documentService } from '../../services/documentService';
import { getApiErrorCode } from '../../utils/apiError';
import { EmptyGenerationState, GenerationFailedState } from '../common/GenerationStates';
import { MarkmapRenderer } from './MarkmapRenderer';
import { useMindMapDownloads } from './useMindMapDownloads';

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
  generateDisabled?: boolean;
  generateDisabledReason?: string;
  /** When provided, an Edit button lets the user revise the mind map source in place. */
  onSaveEdit?: (text: string) => Promise<void>;
}

export const MindMapViewer: React.FC<MindMapViewerProps> = ({
  mindMapText: propMindMapText,
  onGenerate: propOnGenerate,
  isGenerating: propIsGenerating,
  streamingText: propStreamingText,
  title: propTitle,
  externalError,
  generateDisabled = false,
  generateDisabledReason,
  onSaveEdit,
}) => {
  const { currentDocument, setCurrentDocument, updateDocumentInList } = useStudy();
  const isExternal = propOnGenerate !== undefined;

  const [isGeneratingLocal, setIsGeneratingLocal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localMindMarkText, setLocalMindMarkText] = useState<string | null>(null);
  const [localStreamingText, setLocalStreamingText] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
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
    if (generateDisabled) return;
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

  const startEditing = () => {
    setEditDraft(activeMindMarkText ?? '');
    setShowDownloadMenu(false);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!onSaveEdit || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      await onSaveEdit(editDraft);
      // Reflect the edit immediately in internal (document) mode; in external mode the
      // parent updates its own source of truth.
      if (!isExternal) setLocalMindMarkText(editDraft);
      setIsEditing(false);
    } catch {
      // Keep edit mode open so the user doesn't lose their changes on failure.
    } finally {
      setIsSavingEdit(false);
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

  const closeDownloadMenu = useCallback(() => setShowDownloadMenu(false), []);
  const { downloadAsImage, downloadAsPdf, downloadAsXMind, downloadAsXMindMark } =
    useMindMapDownloads({ mmRef, activeMindMarkText, downloadName, closeMenu: closeDownloadMenu });

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
      <GenerationFailedState message={activeError} onRetry={handleGenerate} retryDisabled={generateDisabled} disabledReason={generateDisabledReason} />
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
        actionDisabled={generateDisabled}
        disabledReason={generateDisabledReason}
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

      {isEditing && (
        <div className="absolute inset-0 z-40 flex flex-col gap-3 bg-white/95 backdrop-blur-sm p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
            Edit mind map — one root line, then indented <span className="font-mono normal-case">-</span> bullets
          </p>
          <textarea
            autoFocus
            value={editDraft}
            onChange={e => setEditDraft(e.target.value)}
            className="flex-1 w-full resize-none rounded-xl border border-[var(--primary)]/40 bg-[var(--bg-app)] p-3 text-sm text-text-main outline-none focus:border-[var(--primary)] font-mono leading-relaxed"
            placeholder={'Root topic\n  - Branch\n    - Sub-branch'}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsEditing(false)}
              disabled={isSavingEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-muted hover:bg-zinc-100 transition-all border border-[var(--border-color)] disabled:opacity-50"
            >
              <X size={13} /> Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={isSavingEdit || !editDraft.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[var(--primary)] hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isSavingEdit ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
            </button>
          </div>
        </div>
      )}

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

        {onSaveEdit && (
          <>
            <Divider />
            {/* Edit */}
            <CtrlBtn onClick={startEditing} title="Edit mind map">
              <Pencil size={16} />
            </CtrlBtn>
          </>
        )}

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
                  <FileText size={15} className="text-zinc-400" /> XMindMark
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
