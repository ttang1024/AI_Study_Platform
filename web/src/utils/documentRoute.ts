import { Document } from '../types';

export type DocumentKind = 'audio' | 'article' | 'document';

type DocumentLike = Pick<Document, 'type' | 'originalUrl'>;

/**
 * A Document row is one of three things to the reader — an audio/podcast episode, a web article, or a
 * plain document — and each has its own viewer route. The order matters: a podcast clipped from a feed
 * has an originalUrl too, and it is still an episode, so the audio check has to come first.
 *
 * This rule lived inline at several call sites, each with a slightly different version of it (one
 * forgot 'podcast', one tested originalUrl first, one didn't discriminate at all), which is how
 * episodes ended up opening in the document viewer with no player.
 */
export function getDocumentKind(doc: DocumentLike | undefined): DocumentKind {
  if (doc?.type === 'audio' || doc?.type === 'podcast') return 'audio';
  if (doc?.originalUrl) return 'article';
  return 'document';
}

/**
 * Viewer route for a document. Falls back to the plain document viewer when the document isn't
 * loaded yet — callers that can should hydrate (StudyContext's ensureDocuments) before linking.
 */
export function getDocumentRoute(documentId: string, doc: DocumentLike | undefined): string {
  switch (getDocumentKind(doc)) {
    case 'audio': return `/audio/${documentId}`;
    case 'article': return `/articles/${documentId}`;
    default: return `/documents/${documentId}`;
  }
}
