import React, { useState } from 'react';
import { Check, Loader2, Play, X } from 'lucide-react';
import { usePythonRunner, type RunResult } from '../../hooks/usePythonRunner';

interface Props {
  initialCode?: string;
  /** Python assertions run after the learner's code. When present, the cell auto-grades. */
  tests?: string;
  /** Shown above the editor, e.g. the exercise statement. */
  prompt?: string;
  onPassed?: () => void;
}

/**
 * An editable Python cell that runs in the browser.
 *
 * Execution is entirely client-side (Pyodide in a worker), so nothing the learner writes reaches
 * the server and there is no sandbox to escape from — the blast radius of hostile code is their own
 * tab. That is also why this is available without any server-side runner infrastructure.
 */
export const CodeCell: React.FC<Props> = ({ initialCode = '', tests, prompt, onPassed }) => {
  const { run, running } = usePythonRunner();
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<RunResult | null>(null);

  const execute = async () => {
    const outcome = await run(code, tests);
    setResult(outcome);
    if (outcome.testsPassed) onPassed?.();
  };

  const output = result ? [result.stdout, result.stderr].filter(Boolean).join('\n').trimEnd() : '';

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {prompt && <p className="px-4 py-3 text-sm text-text-main border-b border-border">{prompt}</p>}

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        rows={Math.min(20, Math.max(6, code.split('\n').length + 1))}
        placeholder="# Write Python here"
        className="w-full px-4 py-3 font-mono text-sm bg-surface text-text-main resize-y outline-none"
        // Tab should indent, not move focus — this is a code editor, not a form field.
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return;
          e.preventDefault();
          const target = e.currentTarget;
          const { selectionStart, selectionEnd } = target;
          const next = code.slice(0, selectionStart) + '    ' + code.slice(selectionEnd);
          setCode(next);
          requestAnimationFrame(() => {
            target.selectionStart = target.selectionEnd = selectionStart + 4;
          });
        }}
      />

      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border bg-surface-hover">
        <button
          onClick={() => void execute()}
          disabled={running || !code.trim()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-sm disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? 'Running…' : 'Run'}
        </button>

        {result?.testsPassed !== undefined && (
          <span
            className={`inline-flex items-center gap-1.5 text-sm ${
              result.testsPassed ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {result.testsPassed ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {result.testsPassed ? 'All checks passed' : 'Checks failed'}
          </span>
        )}
      </div>

      {running && !result && (
        <p className="px-4 py-3 text-xs text-text-muted border-t border-border">
          Starting Python… the first run downloads the interpreter, which takes a few seconds.
        </p>
      )}

      {output && (
        <pre
          className={`px-4 py-3 text-xs font-mono whitespace-pre-wrap break-words border-t border-border overflow-x-auto ${
            result?.ok === false ? 'text-red-600' : 'text-text-muted'
          }`}
        >
          {output}
        </pre>
      )}
    </div>
  );
};

export default CodeCell;
