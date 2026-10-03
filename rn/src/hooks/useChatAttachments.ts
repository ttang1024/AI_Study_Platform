import { useCallback, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';

import type { ChatAttachment } from '@/services/chatService';

/** A staged attachment held in the composer before the message is sent. */
export interface PendingAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  /** Raw base64 (no data: URL prefix), ready to send to the API. */
  data: string;
  /** Local file uri used for the inline image thumbnail (images only). */
  previewUri?: string;
  isImage: boolean;
}

export const MAX_ATTACHMENTS = 8;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB — mirrors the backend's ChatAttachments.cs limit

const normalizeMime = (mime: string) => (mime === 'image/jpg' ? 'image/jpeg' : mime);
const createId = () => `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// RN port of web/src/components/ai/useChatAttachments.ts. Images come back
// from expo-image-picker with base64 already inlined (`base64: true`), so no
// extra file read is needed; PDFs from expo-document-picker need a manual
// File(...).base64() read since that picker has no base64 option.
export function useChatAttachments() {
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const attachmentsRef = useRef<PendingAttachment[]>([]);

  const commit = useCallback((next: PendingAttachment[]) => {
    attachmentsRef.current = next;
    setAttachments(next);
  }, []);

  const addPending = useCallback((pending: PendingAttachment) => {
    if (attachmentsRef.current.length >= MAX_ATTACHMENTS) return;
    commit([...attachmentsRef.current, pending]);
  }, [commit]);

  const pickImages = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_ATTACHMENTS,
      quality: 0.8,
      base64: true,
    });
    if (result.canceled) return;
    for (const asset of result.assets) {
      if (attachmentsRef.current.length >= MAX_ATTACHMENTS) break;
      if (!asset.base64) continue;
      if (asset.fileSize && asset.fileSize > MAX_ATTACHMENT_BYTES) continue;
      addPending({
        id: createId(),
        fileName: asset.fileName ?? 'image.jpg',
        mimeType: normalizeMime(asset.mimeType || 'image/jpeg'),
        data: asset.base64,
        previewUri: asset.uri,
        isImage: true,
      });
    }
  }, [addPending]);

  const pickCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, base64: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) return;
    if (asset.fileSize && asset.fileSize > MAX_ATTACHMENT_BYTES) return;
    addPending({
      id: createId(),
      fileName: asset.fileName ?? `photo-${Date.now()}.jpg`,
      mimeType: normalizeMime(asset.mimeType || 'image/jpeg'),
      data: asset.base64,
      previewUri: asset.uri,
      isImage: true,
    });
  }, [addPending]);

  const pickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    for (const asset of result.assets ?? []) {
      if (attachmentsRef.current.length >= MAX_ATTACHMENTS) break;
      if (asset.size && asset.size > MAX_ATTACHMENT_BYTES) continue;
      let data: string;
      try {
        const file = new File(asset.uri);
        data = await file.base64();
      } catch {
        continue;
      }
      addPending({
        id: createId(),
        fileName: asset.name,
        mimeType: 'application/pdf',
        data,
        isImage: false,
      });
    }
  }, [addPending]);

  const removeAttachment = useCallback((id: string) => {
    commit(attachmentsRef.current.filter((a) => a.id !== id));
  }, [commit]);

  const clearAttachments = useCallback(() => {
    commit([]);
  }, [commit]);

  const toChatAttachments = useCallback((): ChatAttachment[] =>
    attachmentsRef.current.map((a) => ({ mimeType: a.mimeType, data: a.data, fileName: a.fileName })),
  []);

  return {
    attachments,
    pickImages,
    pickCamera,
    pickDocument,
    removeAttachment,
    clearAttachments,
    toChatAttachments,
  };
}
