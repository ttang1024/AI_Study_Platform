/** Parsed view of a .ipynb file, enough to render it faithfully read-only. */

export interface NotebookOutput {
  /**
   * `svg` is kept separate from `image` because the two platforms need
   * different things from it: the web viewer inlines the markup as a data URI,
   * while rn hands it to react-native-svg. A raster data URI works in both.
   */
  kind: 'text' | 'image' | 'svg' | 'error';
  /** Plain text, a data: URI for images, or raw markup for svg. */
  value: string;
}

export interface NotebookCell {
  kind: 'markdown' | 'code' | 'raw';
  source: string;
  executionCount?: number | null;
  outputs: NotebookOutput[];
}

export interface Notebook {
  cells: NotebookCell[];
  language?: string;
}

// Notebook `source` and output text are either a string or an array of lines.
const joinSource = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(line => (typeof line === 'string' ? line : '')).join('');
  return '';
};

const parseOutput = (output: Record<string, unknown>): NotebookOutput | null => {
  const type = output.output_type;

  if (type === 'stream') {
    const text = joinSource(output.text);
    return text ? { kind: 'text', value: text } : null;
  }

  if (type === 'error') {
    const traceback = Array.isArray(output.traceback) ? output.traceback.join('\n') : '';
    // Tracebacks carry ANSI colour codes that would render as mojibake.
    const cleaned = traceback.replace(/\[[\d;]*m/g, '').trim();
    const fallback = [output.ename, output.evalue].filter(Boolean).join(': ');
    return { kind: 'error', value: cleaned || fallback || 'Error' };
  }

  if (type === 'display_data' || type === 'execute_result') {
    const data = (output.data ?? {}) as Record<string, unknown>;

    for (const mime of ['image/png', 'image/jpeg', 'image/gif', 'image/webp']) {
      const encoded = data[mime];
      if (typeof encoded === 'string')
        return { kind: 'image', value: `data:${mime};base64,${encoded.replace(/\s/g, '')}` };
    }

    const markup = joinSource(data['image/svg+xml']);
    if (markup) return { kind: 'svg', value: markup };

    const text = joinSource(data['text/plain']);
    return text ? { kind: 'text', value: text } : null;
  }

  return null;
};

/** Returns null when the payload is not a notebook, so the caller can fall back. */
export function parseNotebook(raw: string): Notebook | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const root = parsed as Record<string, unknown>;
  if (!Array.isArray(root.cells)) return null;

  const metadata = (root.metadata ?? {}) as Record<string, unknown>;
  const languageInfo = (metadata.language_info ?? {}) as Record<string, unknown>;
  const language = typeof languageInfo.name === 'string' ? languageInfo.name : undefined;

  const cells: NotebookCell[] = root.cells.map(entry => {
    const cell = (entry ?? {}) as Record<string, unknown>;
    const type = cell.cell_type;
    const outputs = Array.isArray(cell.outputs)
      ? cell.outputs
          .map(output => parseOutput((output ?? {}) as Record<string, unknown>))
          .filter((output): output is NotebookOutput => output !== null)
      : [];

    return {
      kind: type === 'markdown' ? 'markdown' : type === 'raw' ? 'raw' : 'code',
      source: joinSource(cell.source),
      executionCount: typeof cell.execution_count === 'number' ? cell.execution_count : null,
      outputs,
    };
  });

  return { cells, language };
}

/**
 * File name used to pick a highlighter grammar for the notebook's code cells —
 * notebooks are usually Python, but the kernel metadata is authoritative.
 */
export const notebookCodeFileName = (notebook: Notebook): string => {
  const extensions: Record<string, string> = {
    python: 'py', r: 'r', julia: 'jl', scala: 'scala', javascript: 'js',
    typescript: 'ts', ruby: 'rb', bash: 'sh', sql: 'sql', rust: 'rs', go: 'go',
  };
  return `cell.${extensions[notebook.language?.toLowerCase() ?? ''] ?? 'py'}`;
};
