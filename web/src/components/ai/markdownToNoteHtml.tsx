import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

/** Cell children minus the whitespace text nodes react-markdown leaves between cells. */
const cells = (children: React.ReactNode) =>
  React.Children.toArray(children).filter(c => typeof c !== 'string' || c.trim() !== '');

/**
 * The note editor's Tiptap schema (StarterKit) has no tables and no KaTeX, and it
 * drops what it can't represent. So tables flatten to one "a | b | c" paragraph per
 * row, and math keeps its LaTeX source between $ delimiters instead of rendering.
 */
const NOTE_COMPONENTS: Components = {
  table: ({ children }) => <>{children}</>,
  thead: ({ children }) => <>{children}</>,
  tbody: ({ children }) => <>{children}</>,
  tr: ({ children }) => (
    <p>
      {cells(children).map((cell, i) => (
        <React.Fragment key={i}>{i > 0 && ' | '}{cell}</React.Fragment>
      ))}
    </p>
  ),
  th: ({ children }) => <strong>{children}</strong>,
  td: ({ children }) => <>{children}</>,
  pre: ({ children, node }) => {
    const code = node?.children[0];
    const isMath = code?.type === 'element'
      && (code.properties?.className as string[] | undefined)?.includes('math-display');
    return isMath ? <>{children}</> : <pre>{children}</pre>;
  },
  code: ({ children, className }) => {
    if (className?.includes('math-display')) return <p>{`$$${children}$$`}</p>;
    if (className?.includes('math-inline')) return <>{`$${children}$`}</>;
    return <code className={className}>{children}</code>;
  },
};

/** Render an AI reply's markdown to HTML the note editor can insert as formatted text. */
export function markdownToNoteHtml(markdown: string): string {
  return renderToStaticMarkup(
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} components={NOTE_COMPONENTS}>
      {markdown}
    </ReactMarkdown>,
  );
}
