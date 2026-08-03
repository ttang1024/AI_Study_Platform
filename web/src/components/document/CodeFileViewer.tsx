import React, { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { tokenizeLines, type Token } from '../../utils/syntaxHighlight';
import { cn } from '../../utils/cn';

const TOKEN_CLASS: Record<Token['kind'], string> = {
  comment: 'text-zinc-400 italic',
  string: 'text-amber-600',
  number: 'text-violet-600',
  keyword: 'text-teal-600 font-medium',
  plain: '',
};

interface Props {
  code: string;
  /** Only the extension matters — it selects the highlighter grammar. */
  fileName: string;
  /** Rendered above the gutter, e.g. "1,204 lines · JSON". */
  caption?: string;
}

/**
 * Read-only source view: line numbers in a gutter, generic highlighting, and a
 * copy button. Selection has to keep working (the page's selection toolbar
 * turns highlighted text into notes and AI questions), so the gutter is a
 * separate, unselectable column rather than part of each line's text.
 */
export const CodeFileViewer: React.FC<Props> = ({ code, fileName, caption }) => {
  const lines = useMemo(() => tokenizeLines(code, fileName), [code, fileName]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard is unavailable outside a secure context; nothing to recover.
    }
  };

  const gutterWidth = `${String(lines.length).length + 1}ch`;

  return (
    <div className="not-prose rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50 px-3 py-1.5">
        <span className="truncate text-[11px] font-medium text-zinc-500">
          {caption ?? `${lines.length.toLocaleString()} lines`}
        </span>
        <button
          onClick={copy}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-white hover:text-zinc-800 transition-colors"
        >
          {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-[13px] leading-6">
          <tbody>
            {lines.map((tokens, index) => (
              <tr key={index} className="align-top">
                <td
                  className="select-none border-r border-zinc-100 bg-zinc-50/60 px-2 text-right text-zinc-300 tabular-nums"
                  style={{ width: gutterWidth }}
                >
                  {index + 1}
                </td>
                <td className="whitespace-pre px-3 text-zinc-800">
                  {tokens.length === 0
                    ? ' '
                    : tokens.map((token, tokenIndex) => (
                        <span key={tokenIndex} className={cn(TOKEN_CLASS[token.kind])}>
                          {token.text}
                        </span>
                      ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
