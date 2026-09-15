/**
 * Worked-problem step formulas arrive as bare LaTeX ("\theta = 5"), and the model
 * sometimes wraps them in delimiters already. Strip whatever pair is there and
 * re-wrap as a standalone `$$` block — remark-math only treats `$$` as display
 * math when it stands on its own lines; `$$x$$` on one line parses as *inline*
 * math, and double-wrapping an already-delimited formula breaks it outright.
 */
export const toDisplayMath = (formula: string): string => {
  const trimmed = formula.trim();
  const inner =
    /^\$\$[\s\S]*\$\$$/.test(trimmed) ? trimmed.slice(2, -2)
    : /^\\\[[\s\S]*\\\]$/.test(trimmed) ? trimmed.slice(2, -2)
    : /^\\\([\s\S]*\\\)$/.test(trimmed) ? trimmed.slice(2, -2)
    : /^\$[\s\S]*\$$/.test(trimmed) ? trimmed.slice(1, -1)
    : trimmed;
  return `$$\n${inner.trim()}\n$$`;
};

/** Does this string carry anything KaTeX would need to render? */
export const looksLikeLatex = (value: string): boolean => /[\\^_{}$]/.test(value);
