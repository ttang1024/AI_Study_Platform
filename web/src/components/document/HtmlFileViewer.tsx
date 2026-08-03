import React, { useState } from 'react';
import { Code2, Eye } from 'lucide-react';
import { CodeFileViewer } from './CodeFileViewer';
import { cn } from '../../utils/cn';

interface Props {
  html: string;
  fileName: string;
}

/**
 * Uploaded HTML, rendered.
 *
 * The document is someone's arbitrary markup, so it goes into a fully sandboxed
 * iframe: no `allow-scripts`, no `allow-same-origin`, which means no JS, no
 * access to our origin or the user's token, and no network-visible identity.
 * `srcdoc` keeps it out of a fetchable URL as well. The source toggle is the
 * escape hatch when the rendered form drops something.
 */
export const HtmlFileViewer: React.FC<Props> = ({ html, fileName }) => {
  const [showSource, setShowSource] = useState(false);

  return (
    <div className="not-prose">
      <div className="mb-2 flex justify-end">
        <div className="flex rounded-lg bg-zinc-100 p-0.5">
          {([
            ['Rendered', false, Eye],
            ['Source', true, Code2],
          ] as const).map(([label, value, Icon]) => (
            <button
              key={label}
              onClick={() => setShowSource(value)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                showSource === value ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700',
              )}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {showSource ? (
        <CodeFileViewer code={html} fileName={fileName} />
      ) : (
        <iframe
          title={fileName}
          srcDoc={html}
          sandbox=""
          referrerPolicy="no-referrer"
          className="h-[70vh] w-full rounded-xl border border-zinc-200 bg-white"
        />
      )}
    </div>
  );
};
