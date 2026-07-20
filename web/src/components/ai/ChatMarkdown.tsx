import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

/**
 * Compact markdown rendering for chat bubbles (GFM + math), styled to sit inside
 * small rounded message containers. Mirrors the assistant-bubble mapping in ChatPanel.
 */
export const ChatMarkdown: React.FC<{ children: string }> = ({ children }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm, remarkMath]}
    rehypePlugins={[rehypeKatex]}
    components={{
      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
      strong: ({ children }) => <strong className="font-bold">{children}</strong>,
      em: ({ children }) => <em className="italic">{children}</em>,
      ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
      ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
      a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline">{children}</a>,
      code: ({ children, className }) => {
        const isBlock = className?.includes('language-');
        return isBlock
          ? <code className="block my-2 rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100 overflow-x-auto whitespace-pre">{children}</code>
          : <code className="rounded bg-black/10 px-1 py-0.5 text-xs font-mono">{children}</code>;
      },
      pre: ({ children }) => <>{children}</>,
      h1: ({ children }) => <h1 className="mb-1 text-base font-bold">{children}</h1>,
      h2: ({ children }) => <h2 className="mb-1 text-sm font-bold">{children}</h2>,
      h3: ({ children }) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
      blockquote: ({ children }) => <blockquote className="border-l-2 border-current/30 pl-3 italic opacity-80">{children}</blockquote>,
      table: ({ children }) => (
        <div className="my-2 max-w-full overflow-x-auto rounded-lg border border-black/10 bg-white">
          <table className="min-w-full border-collapse text-left text-xs text-zinc-800">{children}</table>
        </div>
      ),
      thead: ({ children }) => <thead className="bg-zinc-100">{children}</thead>,
      th: ({ children }) => <th className="border-b border-r border-black/10 px-3 py-2 font-semibold last:border-r-0">{children}</th>,
      td: ({ children }) => <td className="border-b border-r border-black/10 px-3 py-2 align-top last:border-r-0">{children}</td>,
      tr: ({ children }) => <tr className="last:[&_td]:border-b-0">{children}</tr>,
    }}
  >
    {children}
  </ReactMarkdown>
);

// Moved to the shared package (packages/core); re-exported so existing
// `./ChatMarkdown` imports (e.g. useSpeakReplies) keep working unchanged.
export { markdownToPlainText } from '@core/utils/markdownToPlainText';
