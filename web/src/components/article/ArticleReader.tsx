import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Globe, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Document } from '../../types';
import { getApiUrl } from '../../utils/env';
import { ArticleReaderSkeleton } from '../common/DetailPageSkeleton';

const MARKDOWN_COMPONENTS = {
  h1: ({ children }: { children: React.ReactNode }) => <h1 className="text-2xl font-black mt-8 mb-3 text-text-main">{children}</h1>,
  h2: ({ children }: { children: React.ReactNode }) => <h2 className="text-xl font-bold mt-6 mb-2 text-text-main">{children}</h2>,
  h3: ({ children }: { children: React.ReactNode }) => <h3 className="text-lg font-semibold mt-5 mb-2 text-text-main">{children}</h3>,
  h4: ({ children }: { children: React.ReactNode }) => <h4 className="text-base font-semibold mt-4 mb-1 text-text-main">{children}</h4>,
  h5: ({ children }: { children: React.ReactNode }) => <h5 className="text-sm font-semibold mt-3 mb-1 text-text-main">{children}</h5>,
  h6: ({ children }: { children: React.ReactNode }) => <h6 className="text-xs font-semibold mt-3 mb-1 text-text-muted">{children}</h6>,
  p: ({ children }: { children: React.ReactNode }) => <p className="mb-4">{children}</p>,
  ul: ({ children }: { children: React.ReactNode }) => <ul className="mb-4 ml-5 list-disc space-y-1">{children}</ul>,
  ol: ({ children }: { children: React.ReactNode }) => <ol className="mb-4 ml-5 list-decimal space-y-1">{children}</ol>,
  li: ({ children }: { children: React.ReactNode }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }: { children: React.ReactNode }) => (
    <blockquote className="my-4 border-l-4 border-[var(--primary)] pl-4 text-text-muted italic">{children}</blockquote>
  ),
  strong: ({ children }: { children: React.ReactNode }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }: { children: React.ReactNode }) => <em className="italic">{children}</em>,
  a: ({ href, children }: { href?: string; children: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] underline underline-offset-2 hover:opacity-80">{children}</a>
  ),
  hr: () => <hr className="my-6 border-[var(--border-color)]" />,
  img: ({ src, alt }: { src?: string; alt?: string }) => (
    <span className="block my-4">
      <img
        src={src}
        alt={alt ?? ''}
        className="max-w-full rounded-lg shadow-sm"
        loading="lazy"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
      {alt && <span className="mt-1 block text-center text-xs text-text-muted italic">{alt}</span>}
    </span>
  ),
  code: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    className
      ? <code className={`${className} text-sm font-mono`}>{children}</code>
      : <code className="rounded bg-zinc-100 px-1 py-0.5 text-sm font-mono">{children}</code>,
  pre: ({ children }: { children: React.ReactNode }) => <pre className="mb-4 overflow-x-auto rounded-lg bg-zinc-900 text-zinc-100 p-4 text-sm font-mono">{children}</pre>,
};

interface ArticleReaderProps {
  document: Document;
  onTextSelect: (x: number, y: number, text: string) => void;
}

export const ArticleReader: React.FC<ArticleReaderProps> = React.memo(({ document, onTextSelect }) => {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const readerRef = useRef<HTMLDivElement>(null);

  const API_URL = getApiUrl();

  useEffect(() => {
    if (!document.courseId || !document.id) return;
    setIsLoading(true);
    setError(null);

    const token = localStorage.getItem('sp_access_token');
    fetch(`${API_URL}/api/courses/${document.courseId}/documents/${document.id}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load article content');
        return res.text();
      })
      .then((text) => {
        setContent(text);
        setIsLoading(false);
      })
      .catch(() => {
        setError('Could not load article content.');
        setIsLoading(false);
      });
  }, [document.id, document.courseId]);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    onTextSelect(rect.left + rect.width / 2, rect.top - 12, text);
  }, [onTextSelect]);

  const articleTitle = document.name.replace(/\.(txt|md)$/i, '');

  if (isLoading) {
    return <ArticleReaderSkeleton />;
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-2xl bg-red-50 p-4 text-red-500">
            <AlertCircle size={28} />
          </div>
          <p className="text-sm text-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-app)]">
      <div
        ref={readerRef}
        className="mx-auto max-w-2xl px-8 py-10 pb-20 select-text"
        onMouseUp={handleMouseUp}
      >
        {/* Article title */}
        <h1 className="mb-2 text-2xl font-black tracking-tight text-text-main leading-tight">
          {articleTitle}
        </h1>

        {/* Meta */}
        <div className="mb-8 flex items-center gap-2 text-xs text-text-muted border-b border-[var(--border-color)] pb-4">
          <Globe size={12} />
          <span>Web article</span>
          <span>·</span>
          <span>{new Date(document.uploadDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>

        {/* Article body */}
        <div className="article-body text-[15px] leading-relaxed text-text-main break-words font-[system-ui,sans-serif]">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={MARKDOWN_COMPONENTS}>
            {content ?? ''}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
});
