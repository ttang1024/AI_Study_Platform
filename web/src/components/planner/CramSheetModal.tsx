import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw, Loader2, Printer, NotebookPen } from 'lucide-react';
import { plannerService, type CramSheet } from '../../services/plannerService';
import { ChatMarkdown } from '../ai/ChatMarkdown';

/**
 * Exam cram mode: fetches and shows the AI cheat sheet for one exam plan.
 * The sheet is built server-side from open mistakes + unmastered terms.
 */
export const CramSheetModal: React.FC<{ planId: string; onClose: () => void }> = ({ planId, onClose }) => {
  const [sheet, setSheet] = useState<CramSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      setSheet(await plannerService.getCramSheet(planId, refresh));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Couldn’t build the cram sheet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [planId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handlePrint = () => {
    if (!sheet) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!doctype html><title>${sheet.title} — cram sheet</title><pre style="font-family:ui-sans-serif,system-ui;white-space:pre-wrap;max-width:52rem;margin:2rem auto;line-height:1.5">${sheet.markdown.replace(/</g, '&lt;')}</pre>`);
    win.document.close();
    win.print();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
          <NotebookPen size={16} className="text-teal-600" />
          <h3 className="flex-1 truncate text-sm font-bold text-text-main">
            Cram sheet{sheet ? ` — ${sheet.title}` : ''}
          </h3>
          <button
            onClick={() => load(true)}
            disabled={loading}
            title="Regenerate"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : undefined} />
          </button>
          <button
            onClick={handlePrint}
            disabled={!sheet}
            title="Print"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <Printer size={15} />
          </button>
          <button onClick={onClose} title="Close (Esc)" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
              <Loader2 size={22} className="animate-spin" />
              <p className="text-xs">Summarizing your weak spots into one page…</p>
            </div>
          ) : error ? (
            <p className="py-12 text-center text-sm text-gray-400">{error}</p>
          ) : sheet ? (
            <div className="text-sm leading-relaxed text-text-main">
              <ChatMarkdown>{sheet.markdown}</ChatMarkdown>
            </div>
          ) : null}
        </div>

        {sheet && (
          <p className="border-t border-gray-100 px-5 py-2.5 text-[11px] text-gray-400">
            Built from your open mistakes and unmastered terms · generated {new Date(sheet.generatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
};
