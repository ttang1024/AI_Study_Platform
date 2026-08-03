import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// Stable references for react-markdown. Defined at module scope so their identity
// never changes across renders — otherwise react-markdown unmounts/remounts the
// whole markdown subtree on each render, which wipes the user's text selection.
export const MARKDOWN_REMARK_PLUGINS = [remarkGfm, remarkMath];
export const MARKDOWN_REHYPE_PLUGINS = [rehypeKatex];
export const MARKDOWN_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h1: ({ children }) => <h1 className="mt-8 mb-4 text-3xl font-bold text-zinc-900 border-b border-zinc-200 pb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-7 mb-3 text-2xl font-bold text-zinc-800 border-b border-zinc-100 pb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-6 mb-2 text-xl font-semibold text-zinc-800">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-5 mb-2 text-lg font-semibold text-zinc-700">{children}</h4>,
  h5: ({ children }) => <h5 className="mt-4 mb-1 text-base font-semibold text-zinc-700">{children}</h5>,
  h6: ({ children }) => <h6 className="mt-4 mb-1 text-sm font-semibold text-zinc-600">{children}</h6>,
  p: ({ children }) => <p className="my-3 leading-7 text-zinc-700">{children}</p>,
  ul: ({ children }) => <ul className="my-3 ml-6 list-disc space-y-1 text-zinc-700">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 ml-6 list-decimal space-y-1 text-zinc-700">{children}</ol>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-zinc-300 bg-zinc-50 pl-4 pr-2 py-2 italic text-zinc-600 rounded-r-lg">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    const isBlock = Boolean(className);
    return isBlock
      ? <code className="block">{children}</code>
      : <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[0.875em] font-mono text-zinc-800 border border-zinc-200">{children}</code>;
  },
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-xl bg-zinc-900 p-4 text-sm text-zinc-100 leading-relaxed">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-teal-600 underline underline-offset-2 hover:text-teal-800 transition-colors">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-zinc-900">{children}</strong>,
  em: ({ children }) => <em className="italic text-zinc-700">{children}</em>,
  hr: () => <hr className="my-6 border-zinc-200" />,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-zinc-200">
      <table className="w-full text-sm text-zinc-700">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-zinc-50 text-zinc-800 font-semibold">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-zinc-100">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-zinc-50 transition-colors">{children}</tr>,
  th: ({ children }) => <th className="px-4 py-2 text-left font-semibold border-b border-zinc-200">{children}</th>,
  td: ({ children }) => <td className="px-4 py-2">{children}</td>,
  img: ({ src, alt }) => (
    <img src={src} alt={alt} className="my-4 max-w-full rounded-lg border border-zinc-200 shadow-sm" />
  ),
};
