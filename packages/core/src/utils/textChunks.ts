const MAX_CHUNK = 5000;

/**
 * Splits narration text into request-sized pieces for the speech endpoint.
 *
 * <p>Cuts at a sentence boundary wherever one is available inside the limit, so a chunk's audio
 * does not clip mid-sentence when the pieces are played back-to-back.</p>
 */
export function splitIntoSpeechChunks(text: string): string[] {
  if (text.length <= MAX_CHUNK) return [text];

  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > MAX_CHUNK) {
    const slice = remaining.slice(0, MAX_CHUNK);
    const cut = Math.max(
      slice.lastIndexOf('. '),
      slice.lastIndexOf('.\n'),
      slice.lastIndexOf('! '),
      slice.lastIndexOf('? '),
    );
    const splitAt = cut > 0 ? cut + 1 : MAX_CHUNK;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}
