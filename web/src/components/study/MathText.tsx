import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { cn } from '../../utils/cn';

// Fast-path: only invoke react-markdown when math or markdown syntax is detected
const RICH_PATTERN = /\$|[*_`#\[>~\\]/;

interface MathTextProps {
  text: string;
  className?: string;
  /**
   * inline=true (default): strip <p> wrappers so the output stays inline.
   * inline=false: keep <p> tags for block/multi-paragraph content.
   */
  inline?: boolean;
}

export const MathText: React.FC<MathTextProps> = ({ text, className, inline = true }) => {
  if (!text) return null;

  if (!RICH_PATTERN.test(text)) {
    return <span className={className}>{text}</span>;
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) =>
          inline
            ? <span className={cn('leading-relaxed', className)}>{children}</span>
            : <p className={cn('mb-2 last:mb-0', className)}>{children}</p>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
};
