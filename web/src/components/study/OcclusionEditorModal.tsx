import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X, ImagePlus, Loader2, Undo2, Check } from 'lucide-react';
import type { OcclusionRect } from '../../types';
import { flashcardService } from '../../services/flashcardService';

interface OcclusionEditorModalProps {
  onClose: () => void;
  onCreated: () => void;
}

type DraftRect = { x: number; y: number; w: number; h: number };

/**
 * Image-occlusion card editor: pick an image, drag rectangles over the parts to
 * memorize, optionally label them, and save. Coordinates are stored normalized
 * (0–1) so masks track the image at any rendered size.
 */
export const OcclusionEditorModal: React.FC<OcclusionEditorModalProps> = ({ onClose, onCreated }) => {
  const [file, setFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [rects, setRects] = useState<OcclusionRect[]>([]);
  const [drawing, setDrawing] = useState<DraftRect | null>(null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) {
      setError('Use a PNG, JPEG, WebP or GIF image.');
      return;
    }
    setError(null);
    setFile(f);
    setRects([]);
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(f);
  };

  const pointOf = (e: React.PointerEvent): { x: number; y: number } | null => {
    const el = imageRef.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const p = pointOf(e);
    if (!p) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrawing({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing) return;
    const p = pointOf(e);
    if (!p) return;
    setDrawing(d => d && { ...d, w: p.x - d.x, h: p.y - d.y });
  };

  const onPointerUp = () => {
    if (!drawing) return;
    // Normalize negative drags and drop accidental clicks.
    const rect = {
      x: Math.min(drawing.x, drawing.x + drawing.w),
      y: Math.min(drawing.y, drawing.y + drawing.h),
      w: Math.abs(drawing.w),
      h: Math.abs(drawing.h),
    };
    setDrawing(null);
    if (rect.w > 0.015 && rect.h > 0.015) {
      setRects(prev => [...prev, rect]);
    }
  };

  const save = async () => {
    if (!file || rects.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await flashcardService.createOcclusionCard({
        image: file,
        occlusions: rects,
        front: front.trim() || undefined,
        back: back.trim() || undefined,
      });
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Could not save the card.');
    } finally {
      setSaving(false);
    }
  };

  const displayRect = (r: DraftRect) => ({
    left: `${Math.min(r.x, r.x + r.w) * 100}%`,
    top: `${Math.min(r.y, r.y + r.h) * 100}%`,
    width: `${Math.abs(r.w) * 100}%`,
    height: `${Math.abs(r.h) * 100}%`,
  });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-text-main">New image-occlusion card</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-text-main"><X size={18} /></button>
        </div>

        {!imageSrc ? (
          <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border-color)] py-16 cursor-pointer hover:border-[var(--primary)]/50 transition-colors">
            <ImagePlus size={28} className="text-zinc-300" />
            <span className="text-sm text-text-muted">Choose a diagram, chart, or photo</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={e => pickFile(e.target.files?.[0] ?? null)}
            />
          </label>
        ) : (
          <>
            <p className="text-xs text-text-muted mb-2">
              Drag over the parts you want to memorize — each rectangle becomes a hidden region.
            </p>
            <div
              ref={imageRef}
              className="relative inline-block max-w-full select-none touch-none cursor-crosshair"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <img src={imageSrc} alt="Occlusion source" className="max-w-full max-h-[380px] rounded-xl" draggable={false} />
              {rects.map((r, i) => (
                <div
                  key={i}
                  className="absolute rounded-[3px] border-2 border-amber-400 bg-amber-300/80 flex items-center justify-center"
                  style={displayRect(r as DraftRect)}
                >
                  <span className="text-[10px] font-bold text-amber-900">{i + 1}</span>
                </div>
              ))}
              {drawing && (
                <div className="absolute rounded-[3px] border-2 border-dashed border-amber-500 bg-amber-200/50" style={displayRect(drawing)} />
              )}
            </div>

            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs font-semibold text-text-muted">{rects.length} mask{rects.length === 1 ? '' : 's'}</span>
              <button
                onClick={() => setRects(prev => prev.slice(0, -1))}
                disabled={rects.length === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-color)] px-2 py-1 text-xs text-text-muted hover:text-text-main disabled:opacity-40"
              >
                <Undo2 size={12} /> Undo
              </button>
              <label className="ml-auto text-xs text-[var(--primary)] font-semibold cursor-pointer">
                Change image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={e => pickFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="mt-4 space-y-2">
              <input
                type="text"
                placeholder="Prompt (optional) — e.g. Name the parts of the cell"
                value={front}
                onChange={e => setFront(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              />
              <input
                type="text"
                placeholder="Answer notes (optional) — shown after the reveal"
                value={back}
                onChange={e => setBack(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              />
            </div>
          </>
        )}

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-semibold text-text-muted">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!file || rects.length === 0 || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Create card
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
};
