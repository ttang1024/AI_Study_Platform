// Note content is opaque HTML produced by web's tiptap editor (the backend does no
// transformation). RN doesn't render rich HTML, so strip tags/entities to plain text
// for display. Editing then round-trips as plain text, same as any note created on mobile.
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
