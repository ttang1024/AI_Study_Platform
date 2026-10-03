import type { Document } from '../types';

/**
 * How a library document should be presented, independent of its stored `type`.
 *
 * Podcasts arrive carrying an `originalUrl` just like clipped web articles do, so the audio check
 * has to win — ordering this the other way files every podcast under "article". Both apps had this
 * inline in several places (set grouping, calendars, library rows); it lives here so the ordering
 * only has to be right once.
 */
export type DocumentSourceKind = 'doc' | 'article' | 'audio';

export const documentSourceKind = (
  doc: Pick<Document, 'type' | 'originalUrl'> | undefined | null,
): DocumentSourceKind => {
  if (!doc) return 'doc';
  if (doc.type === 'audio' || doc.type === 'podcast') return 'audio';
  return doc.originalUrl ? 'article' : 'doc';
};

/**
 * Display name for a document. Clipped web articles are stored with a generated `.md`/`.txt`
 * suffix that is noise on screen; genuinely uploaded Markdown keeps its extension.
 */
export const getDocDisplayName = (
  doc: Pick<Document, 'name' | 'type' | 'originalUrl'>,
): string => (doc.originalUrl ? doc.name.replace(/\.(md|txt)$/i, '') : doc.name);
