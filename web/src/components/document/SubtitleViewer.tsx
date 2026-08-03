import React, { useMemo } from 'react';
import { parseCues } from '../../utils/subtitleCues';

interface Props {
  text: string;
  fileName: string;
}

/**
 * Captions as a timestamped transcript. The cue text stays plain, selectable
 * prose so the page's selection toolbar (note / ask AI) works on it the same
 * way it does on a summary.
 */
export const SubtitleViewer: React.FC<Props> = ({ text, fileName }) => {
  const cues = useMemo(() => parseCues(text, fileName), [text, fileName]);

  if (cues.length === 0)
    return <pre className="whitespace-pre-wrap font-sans break-words">{text}</pre>;

  return (
    <div className="not-prose">
      <p className="mb-3 text-[11px] font-medium text-zinc-500">
        {cues.length.toLocaleString()} {cues.length === 1 ? 'cue' : 'cues'}
      </p>
      <ol className="space-y-1">
        {cues.map((cue, index) => (
          <li key={index} className="flex gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-50 transition-colors">
            {cue.start && (
              <span className="shrink-0 select-none pt-0.5 font-mono text-[11px] tabular-nums text-zinc-400">
                {cue.start}
              </span>
            )}
            <span className="whitespace-pre-wrap text-sm leading-6 text-zinc-700">{cue.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};
