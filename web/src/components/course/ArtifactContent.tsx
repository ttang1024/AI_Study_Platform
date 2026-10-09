import React from 'react';
import { cn } from '../../utils/cn';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import { SummaryMarkdown } from '../study/SummaryMarkdown';

const hasHtmlMarkup = (value: string): boolean => /<\/?[a-z][\s\S]*>/i.test(value);

export const ArtifactContent: React.FC<{ value: string; className?: string }> = ({ value, className }) => {
  if (hasHtmlMarkup(value)) {
    return (
      <div
        className={cn('prose prose-sm max-w-none', className)}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
      />
    );
  }
  return (
    <div className={cn('prose prose-sm max-w-none artifact-markdown', className)}>
      <SummaryMarkdown value={value} />
    </div>
  );
};
