import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

/**
 * Markdown rendering for assistant bubbles inside ChatPanel (GFM + math),
 * themed with the app's text/border variables. ChatMarkdown is the
 * neutral-surface variant used elsewhere.
 */
export const ChatBubbleMarkdown: React.FC<{ children: string }> = ({ children }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm, remarkMath]}
    rehypePlugins={[rehypeKatex]}
    components={{
      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
      strong: ({ children }) => <strong className="font-bold text-text-main">{children}</strong>,
      em: ({ children }) => <em className="italic">{children}</em>,
      ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
      ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
      code: ({ children, className }) => {
        const isBlock = className?.includes('language-');
        return isBlock
          ? <code className="block my-2 rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100 overflow-x-auto whitespace-pre">{children}</code>
          : <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs text-zinc-800 font-mono">{children}</code>;
      },
      pre: ({ children }) => <>{children}</>,
      h1: ({ children }) => <h1 className="mb-1 text-base font-bold">{children}</h1>,
      h2: ({ children }) => <h2 className="mb-1 text-sm font-bold">{children}</h2>,
      h3: ({ children }) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
      blockquote: ({ children }) => <blockquote className="border-l-2 border-[var(--primary)]/40 pl-3 italic text-text-muted">{children}</blockquote>,
      table: ({ children }) => (
        <div className="my-2 max-w-full overflow-x-auto rounded-lg border border-[var(--border-color)] bg-white">
          <table className="min-w-full border-collapse text-left text-xs">{children}</table>
        </div>
      ),
      thead: ({ children }) => <thead className="bg-zinc-100 text-text-main">{children}</thead>,
      th: ({ children }) => <th className="border-b border-r border-[var(--border-color)] px-3 py-2 font-semibold last:border-r-0">{children}</th>,
      td: ({ children }) => <td className="border-b border-r border-[var(--border-color)] px-3 py-2 align-top last:border-r-0">{children}</td>,
      tr: ({ children }) => <tr className="last:[&_td]:border-b-0">{children}</tr>,
    }}
  >
    {children}
  </ReactMarkdown>
);
