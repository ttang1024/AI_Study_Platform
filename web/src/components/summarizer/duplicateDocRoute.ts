import { Document } from '../../types';

/**
 * Viewer route for a document the upload tabs found to be a duplicate.
 *
 * Deliberately not `utils/documentRoute`: that helper routes by clip origin (originalUrl), while the
 * upload tabs treat an *uploaded* .md as an article too. Audio has to be tested first — a podcast
 * pulled from a feed carries an originalUrl like a clipped article does, but it still needs the player.
 */
export function getDuplicateDocRoute(doc: Pick<Document, 'id' | 'type' | 'originalUrl'>): string {
  if (doc.type === 'audio' || doc.type === 'podcast') return `/audio/${doc.id}`;
  if (doc.type === 'md' || doc.originalUrl) return `/articles/${doc.id}`;
  return `/documents/${doc.id}`;
}
