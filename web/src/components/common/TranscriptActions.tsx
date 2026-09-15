import { useEffect, useRef, useState } from 'react';
import { Copy, Download, RotateCcw } from 'lucide-react';

const btn = 'flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-text-muted hover:bg-zinc-100 transition-colors';
const menuItem = 'w-full px-3 py-2 text-left text-[11px] text-text-main hover:bg-zinc-50 transition-colors';

/**
 * Copy / download / refresh controls above a transcript.
 *
 * <p>Owns its own menu state and click-outside handling so the audio and video pages — which show
 * the same three controls over the same two export formats — don't each carry a copy.</p>
 */
export function TranscriptActions({ onCopy, onDownload, onRefresh, isRefreshing }: {
  onCopy: (withTimestamps: boolean) => void;
  onDownload: (format: 'txt' | 'srt', withTimestamps: boolean) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}) {
  const [openMenu, setOpenMenu] = useState<'copy' | 'download' | null>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const downloadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (copyRef.current?.contains(target) || downloadRef.current?.contains(target)) return;
      setOpenMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenu]);

  const pick = (run: () => void) => () => { run(); setOpenMenu(null); };

  return (
    <div className="flex items-center gap-1">
      <div className="relative" ref={copyRef}>
        <button onClick={() => setOpenMenu(openMenu === 'copy' ? null : 'copy')} className={btn}>
          <Copy size={11} /> Copy
        </button>
        {openMenu === 'copy' && (
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[170px] rounded-lg border border-[var(--border-color)] bg-white shadow-lg overflow-hidden">
            <button onClick={pick(() => onCopy(true))} className={menuItem}>Copy with timestamp</button>
            <button onClick={pick(() => onCopy(false))} className={menuItem}>Copy without timestamp</button>
          </div>
        )}
      </div>

      <div className="relative" ref={downloadRef}>
        <button onClick={() => setOpenMenu(openMenu === 'download' ? null : 'download')} className={btn}>
          <Download size={11} /> Download
        </button>
        {openMenu === 'download' && (
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[190px] rounded-lg border border-[var(--border-color)] bg-white shadow-lg overflow-hidden">
            <button onClick={pick(() => onDownload('txt', true))} className={menuItem}>TXT with timestamps</button>
            <button onClick={pick(() => onDownload('txt', false))} className={menuItem}>TXT without timestamps</button>
            <button onClick={pick(() => onDownload('srt', true))} className={menuItem}>SRT with timestamps</button>
            <button onClick={pick(() => onDownload('srt', false))} className={menuItem}>SRT without timestamps</button>
          </div>
        )}
      </div>

      <TranscriptRefreshButton onClick={onRefresh} isRefreshing={isRefreshing} />
    </div>
  );
}

/** The bare refresh control, also shown on its own when a transcript failed to load. */
export function TranscriptRefreshButton({ onClick, isRefreshing, label = 'Refresh' }: {
  onClick: () => void;
  isRefreshing?: boolean;
  label?: string;
}) {
  return (
    <button onClick={onClick} disabled={isRefreshing} className={`${btn} disabled:opacity-50`}>
      <RotateCcw size={11} className={isRefreshing ? 'animate-spin' : ''} /> {label}
    </button>
  );
}
