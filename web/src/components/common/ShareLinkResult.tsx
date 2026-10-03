import { Check, Copy, ExternalLink } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * The "here is your link" state both share dialogs end on: confirmation, the URL with a copy
 * button, and a way to open it.
 */
export function ShareLinkResult({ shareUrl, subtitle, copied, onCopy }: {
  shareUrl: string;
  /** What was shared, e.g. "12 terms shared." */
  subtitle: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <>
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
          <Check size={20} className="text-emerald-600" />
        </div>
        <p className="text-sm font-semibold text-emerald-800">Share link created!</p>
        <p className="text-xs text-emerald-600 mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-zinc-50 px-3 py-2.5">
        <span className="flex-1 text-xs text-text-main truncate font-mono">{shareUrl}</span>
        <button
          onClick={onCopy}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shrink-0',
            copied ? 'bg-emerald-100 text-emerald-700' : 'bg-primary text-white hover:opacity-90',
          )}
        >
          {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>

      <a
        href={shareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full rounded-xl border border-[var(--border-color)] py-2.5 text-sm font-medium text-text-muted hover:text-primary hover:border-primary/30 transition-all"
      >
        <ExternalLink size={14} />
        Open shared page
      </a>
    </>
  );
}
