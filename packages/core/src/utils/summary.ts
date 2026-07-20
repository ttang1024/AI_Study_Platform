/** Older documents store `summary` as a JSON blob (`{ summary, keyPoints }`) instead of
 * raw markdown — unwrap it to displayable markdown; newer raw-markdown summaries pass through. */
export function normalizeSummaryText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const text = (parsed.summary || '')
      + (parsed.keyPoints && parsed.keyPoints.length > 0
        ? '\n\n**Key Points:**\n' + parsed.keyPoints.map((p: string) => `- ${p}`).join('\n')
        : '');
    return text || raw;
  } catch {
    return raw;
  }
}
