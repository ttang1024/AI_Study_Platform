import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { parseNotebook, notebookCodeFileName } from '../../utils/notebook';
import { MARKDOWN_COMPONENTS, MARKDOWN_REHYPE_PLUGINS, MARKDOWN_REMARK_PLUGINS } from './markdownComponents';
import { CodeFileViewer } from './CodeFileViewer';

interface Props {
  text: string;
  fileName: string;
}

/**
 * Read-only Jupyter rendering: markdown cells as markdown, code cells
 * highlighted, and whatever outputs were saved with the notebook. Nothing is
 * executed — the platform's runnable cells are a separate feature.
 */
export const NotebookViewer: React.FC<Props> = ({ text, fileName }) => {
  const notebook = useMemo(() => parseNotebook(text), [text]);

  // Not a notebook after all (truncated upload, wrong extension) — show the JSON.
  if (!notebook) return <CodeFileViewer code={text} fileName={fileName} />;

  const codeFileName = notebookCodeFileName(notebook);

  return (
    <div className="not-prose space-y-4">
      {notebook.cells.map((cell, index) => {
        if (cell.kind === 'markdown')
          return (
            <div key={index}>
              <ReactMarkdown
                remarkPlugins={MARKDOWN_REMARK_PLUGINS}
                rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
                components={MARKDOWN_COMPONENTS}
              >
                {cell.source}
              </ReactMarkdown>
            </div>
          );

        if (cell.kind === 'raw')
          return (
            <pre key={index} className="whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 font-mono text-[13px] text-zinc-600">
              {cell.source}
            </pre>
          );

        return (
          <div key={index} className="space-y-2">
            <CodeFileViewer
              code={cell.source}
              fileName={codeFileName}
              caption={cell.executionCount != null ? `In [${cell.executionCount}]` : 'In [ ]'}
            />

            {cell.outputs.map((output, outputIndex) => {
              if (output.kind === 'image' || output.kind === 'svg')
                return (
                  <img
                    key={outputIndex}
                    src={
                      output.kind === 'svg'
                        ? `data:image/svg+xml;utf8,${encodeURIComponent(output.value)}`
                        : output.value
                    }
                    alt="Cell output"
                    className="mx-auto max-w-full rounded-lg border border-zinc-200"
                  />
                );

              return (
                <pre
                  key={outputIndex}
                  className={`overflow-x-auto whitespace-pre-wrap rounded-xl px-3 py-2 font-mono text-[13px] leading-6 ${
                    output.kind === 'error'
                      ? 'bg-red-50 text-red-700 border border-red-100'
                      : 'bg-zinc-50 text-zinc-700'
                  }`}
                >
                  {output.value}
                </pre>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
