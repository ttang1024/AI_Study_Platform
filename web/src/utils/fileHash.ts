export async function calculateSha256(file: File): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;

  const buffer = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

