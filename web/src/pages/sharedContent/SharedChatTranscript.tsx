import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from '../../utils/cn';

interface SharedChatMessage {
  role: 'user' | 'model';
  content: string;
}

function legacySharedChatHtmlToMessages(value: string): SharedChatMessage[] | null {
  if (typeof document === 'undefined' || !value.includes('data-shared-chat')) {
    return null;
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = value;
  const sections = Array.from(wrapper.querySelectorAll('section'));

  const messages = sections.map(section => {
    const columns = Array.from(section.children).filter(child => child.tagName.toLowerCase() === 'div');
    const avatar = columns[0]?.textContent?.trim();
    const contentColumn = columns[1];
    if (!contentColumn) return null;

    const normalizedHtml = contentColumn.innerHTML
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
    const textHolder = document.createElement('div');
    textHolder.innerHTML = normalizedHtml;
    const content = textHolder.textContent?.trim() ?? '';

    if (!content) return null;
    return {
      role: avatar === 'You' ? 'user' : 'model',
      content,
    } satisfies SharedChatMessage;
  }).filter((message): message is SharedChatMessage => message !== null);

  return messages.length > 0 ? messages : null;
}

function parseSharedChatTranscript(value: string): SharedChatMessage[] | null {
  try {
    const parsed = JSON.parse(value) as {
      type?: string;
      messages?: Array<{ role?: string; content?: unknown }>;
    };

    if (parsed.type !== 'chat-transcript' || !Array.isArray(parsed.messages)) {
      return null;
    }

    return parsed.messages
      .filter(message => (message.role === 'user' || message.role === 'model') && typeof message.content === 'string')
      .map(message => ({
        role: message.role as 'user' | 'model',
        content: message.content as string,
      }));
  } catch {
    return legacySharedChatHtmlToMessages(value);
  }
}

export const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-bold text-text-main">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="leading-relaxed">{children}</li>,
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isBlock = className?.includes('language-');
    return isBlock
      ? <code className="block my-2 overflow-x-auto whitespace-pre rounded-lg bg-zinc-900 p-3 font-mono text-xs text-zinc-100">{children}</code>
      : <code className="rounded bg-zinc-200 px-1 py-0.5 font-mono text-xs text-zinc-800">{children}</code>;
  },
  h1: ({ children }: { children?: React.ReactNode }) => <h1 className="mb-2 text-lg font-bold">{children}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2 className="mb-2 text-base font-bold">{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-primary/40 pl-3 italic text-text-muted">{children}</blockquote>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-3 overflow-x-auto">
      <table className="min-w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => <th className="border border-[var(--border-color)] px-2 py-1 text-left font-bold">{children}</th>,
  td: ({ children }: { children?: React.ReactNode }) => <td className="border border-[var(--border-color)] px-2 py-1 align-top">{children}</td>,
};

export const SharedChatTranscript: React.FC<{ value: string }> = ({ value }) => {
  const messages = parseSharedChatTranscript(value);

  if (!messages) {
    return (
      <div className="prose prose-sm max-w-none text-text-main">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
          {value}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {messages.map((message, index) => {
        const isUser = message.role === 'user';
        return (
          <section key={index} className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
            <div className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
              isUser
                ? 'border border-[var(--border-color)] bg-[var(--bg-app)] text-text-muted'
                : 'bg-primary text-white',
            )}>
              {isUser ? 'You' : 'AI'}
            </div>
            <div className={cn(
              'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed text-text-main',
              isUser
                ? 'rounded-tr-sm border border-[var(--border-color)] bg-[var(--bg-app)]'
                : 'rounded-tl-sm border border-primary/20 bg-primary/10',
            )}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={markdownComponents}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          </section>
        );
      })}
    </div>
  );
};
