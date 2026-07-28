// Moved to the shared package (packages/core) — web needs the same flattening for
// knowledge-graph node labels, and a regex (not the DOM) is what works on both.
// Note content is opaque HTML produced by web's tiptap editor (the backend does no
// transformation). RN doesn't render rich HTML, so strip tags/entities to plain text
// for display. Editing then round-trips as plain text, same as any note created on mobile.
export { stripHtml, stripHtmlInline } from '@core/utils/stripHtml';
