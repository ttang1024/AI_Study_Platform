import React from 'react';
import { cn } from '../../utils/cn';
import { MathText } from './MathText';

interface ClozeTextProps {
  text: string;
  revealed: boolean;
  className?: string;
}

const CLOZE_REGEX = /\{\{([^}]+)\}\}/g;

/**
 * Renders a cloze deletion sentence with optional inline math.
 * Hidden:    "React uses _______ to improve performance."
 * Revealed:  "React uses [virtual DOM] to improve performance." (highlighted)
 * Math also renders in non-cloze segments, e.g. "$E = mc^2$"
 */
export const ClozeText: React.FC<ClozeTextProps> = ({ text, revealed, className }) => {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  const regex = new RegExp(CLOZE_REGEX.source, 'g');
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const segment = text.slice(lastIndex, match.index);
      parts.push(<MathText key={key++} text={segment} inline />);
    }

    const term = match[1];
    if (revealed) {
      parts.push(
        <span
          key={key++}
          className="inline-block rounded-md bg-[var(--primary)]/15 px-1.5 py-0.5 font-bold text-[var(--primary)] mx-0.5"
        >
          {term}
        </span>
      );
    } else {
      parts.push(
        <span
          key={key++}
          className="inline-block rounded-md border-2 border-dashed border-[var(--primary)]/40 bg-[var(--primary)]/5 px-3 py-0.5 font-bold text-transparent select-none mx-0.5 min-w-[4rem]"
          style={{ color: 'transparent', userSelect: 'none' }}
          aria-hidden="true"
        >
          {term}
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<MathText key={key++} text={text.slice(lastIndex)} inline />);
  }

  return (
    <span className={cn('leading-loose', className)}>
      {parts}
    </span>
  );
};
