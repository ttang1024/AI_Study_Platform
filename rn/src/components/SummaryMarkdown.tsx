import React from 'react';
import Markdown from 'react-native-markdown-display';

import { MathMarkdown } from '@/components/MathMarkdown';
import { Colors, Spacing } from '@/constants/theme';
import { containsTexMath } from '@/utils/mathMarkdownHtml';

const markdownStyles = {
  body: { color: Colors.textPrimary, fontSize: 14, lineHeight: 21 },
  heading1: { color: Colors.primary, fontSize: 13, fontWeight: '800' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginTop: Spacing.two, marginBottom: Spacing.one },
  heading2: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' as const, marginTop: Spacing.three, marginBottom: Spacing.one },
  heading3: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' as const, marginTop: Spacing.two, marginBottom: Spacing.one },
  strong: { fontWeight: '700' as const, color: Colors.textPrimary },
  bullet_list: { marginTop: Spacing.one },
  ordered_list: { marginTop: Spacing.one },
  list_item: { marginBottom: Spacing.half },
  code_inline: { backgroundColor: Colors.zinc200, borderRadius: 4, paddingHorizontal: 4 },
  code_block: { backgroundColor: '#18181b', color: '#f4f4f5', borderRadius: 12, padding: Spacing.two },
  fence: { backgroundColor: '#18181b', color: '#f4f4f5', borderRadius: 12, padding: Spacing.two },
  blockquote: { borderLeftColor: Colors.primary, borderLeftWidth: 3, paddingLeft: Spacing.two, opacity: 0.85 },
};

// Math-bearing content goes through the KaTeX WebView; everything else keeps the
// cheaper native renderer (react-native-markdown-display has no math support).
export const SummaryMarkdown: React.FC<{ value: string }> = ({ value }) =>
  containsTexMath(value)
    ? <MathMarkdown value={value} />
    : <Markdown style={markdownStyles}>{value}</Markdown>;
