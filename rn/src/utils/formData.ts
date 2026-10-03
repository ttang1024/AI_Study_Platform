import type { PickedFile } from '@/types';

/**
 * React Native's FormData.append accepts `{ uri, name, type }` file parts (see
 * react-native/Libraries/Network/FormData.js), but TS resolves the DOM lib's
 * FormData typing here, whose `append` only accepts `Blob`. The cast bypasses
 * that mismatch; the object shape is what RN's native bridge actually expects.
 */
export function toFormDataPart(file: PickedFile): Blob {
  return { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob;
}
