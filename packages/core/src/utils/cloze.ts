// Cloze cards store `{{term}}`-style markers in `front` (not `back` — `back` is
// empty for cloze cards). Front-of-card view blanks the markers out; back-of-card
// view reveals the term inline. Web's ClozeText renders the same pattern as React
// spans; rn derives plain question/answer strings.
export const CLOZE_PATTERN = /\{\{([^}]+)\}\}/g;

// Some cards contain `{{term}}` markup in `front` without being tagged
// cardType: 'cloze' (e.g. generation mistagging) — detect from content so
// the raw braces never leak into the UI regardless of the declared type.
export const hasClozeMarkers = (text: string): boolean => new RegExp(CLOZE_PATTERN.source).test(text);

export const clozeQuestionText = (text: string): string => text.replace(CLOZE_PATTERN, '_____');

export const clozeAnswerText = (text: string): string => text.replace(CLOZE_PATTERN, '$1');
