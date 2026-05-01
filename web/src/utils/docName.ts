import { Document } from '../types';

/**
 * Returns the display name for a document.
 * Web articles with an originalUrl have their generated suffix stripped.
 * Regular uploaded .md files keep the extension as-is.
 */
export function getDocDisplayName(doc: Pick<Document, 'name' | 'type' | 'originalUrl'>): string {
  if (doc.originalUrl) {
    return doc.name.replace(/\.(md|txt)$/i, '');
  }
  return doc.name;
}
