import type { LibraryEntry } from '@/services/libraryService';
import type { Document, PickedFile } from '@/types';

/**
 * The library document a picked file duplicates, if any.
 *
 * Matches on file name + exact byte size rather than on content. The API stores a SHA-256 of the
 * upload, but reproducing it here means pulling the whole file through JS to hash it — audio
 * lectures run to 100 MB, which is not something to do on a phone on every pick. Name plus exact
 * size is a strong enough signal for "I already uploaded this", and the server still rejects real
 * duplicates with DUPLICATE_DOCUMENT. Size is only compared when both sides know it.
 *
 * Web can afford the real hash (`utils/fileHash`), so its tabs match on content instead.
 */
export function findDuplicateDocument(
  entries: LibraryEntry[],
  file: PickedFile | null,
): Document | undefined {
  if (!file) return undefined;
  const name = file.name.trim().toLowerCase();

  const match = entries.find((e) =>
    e.kind === 'document'
    && e.data.name.trim().toLowerCase() === name
    && (file.size === undefined || !e.data.fileSize || e.data.fileSize === file.size));

  return match?.kind === 'document' ? match.data : undefined;
}
