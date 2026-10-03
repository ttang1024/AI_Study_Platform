import React, { useMemo } from 'react';

import { AutoHeightWebView } from '@/components/AutoHeightWebView';
import { buildMathMarkdownHtml } from '@/utils/mathMarkdownHtml';

interface MathMarkdownProps {
  value: string;
  /** Disable touch so a wrapping Pressable (e.g. a flashcard) still gets taps. */
  pointerEventsNone?: boolean;
}

/**
 * Renders markdown containing TeX math (KaTeX in a WebView) at its natural
 * height. Use SummaryMarkdown for general markdown — it delegates here only
 * when math delimiters are present.
 */
export const MathMarkdown: React.FC<MathMarkdownProps> = ({ value, pointerEventsNone }) => {
  const html = useMemo(() => buildMathMarkdownHtml(value), [value]);
  return <AutoHeightWebView html={html} pointerEventsNone={pointerEventsNone} />;
};
