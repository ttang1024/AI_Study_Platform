// Note bodies and some AI-generated titles are opaque HTML (web's tiptap editor
// writes it; the backend does no transformation). Consumers that render plain
// text — RN's note screens, the knowledge-graph node labels on both platforms —
// need it flattened. Regex rather than a DOM: this has to run under RN too.
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  nbsp: ' ',
};

export const stripHtml = (html: string): string =>
  html
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&([a-z#0-9]+);/gi, (match, code) => ENTITIES[code.toLowerCase()] ?? match)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Single-line variant for labels: collapses every run of whitespace to one space. */
export const stripHtmlInline = (html: string): string => stripHtml(html).replace(/\s+/g, ' ').trim();
