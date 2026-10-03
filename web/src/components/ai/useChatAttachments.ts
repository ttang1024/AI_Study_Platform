import React, { useEffect, useRef, useState } from 'react';

/** A staged attachment held in the composer before the message is sent. */
export interface PendingAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  /** Raw base64 (no data: URL prefix), ready to send to the API. */
  data: string;
  /** Object URL used for the inline image thumbnail (images only). */
  previewUrl?: string;
  isImage: boolean;
}

export const MAX_ATTACHMENTS = 8;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB
export const ATTACHMENT_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,application/pdf';

/** Read a file into raw base64, stripping the `data:<mime>;base64,` prefix. */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Composer attachment state: paperclip / paste / drag-and-drop staging for images + PDFs. */
export const useChatAttachments = (enabled: boolean) => {
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const attachmentsRef = useRef<PendingAttachment[]>([]);
  useEffect(() => { attachmentsRef.current = attachments; }, [attachments]);
  // Release image preview object URLs when the panel unmounts.
  useEffect(() => () => attachmentsRef.current.forEach(a => a.previewUrl && URL.revokeObjectURL(a.previewUrl)), []);

  const handleFiles = async (files: File[]) => {
    const accepted = files.filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
    for (const file of accepted) {
      if (file.size > MAX_ATTACHMENT_BYTES) continue;
      let data: string;
      try { data = await readFileAsBase64(file); } catch { continue; }
      const isImage = file.type.startsWith('image/');
      setAttachments(prev => {
        if (prev.length >= MAX_ATTACHMENTS) return prev;
        return [...prev, {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fileName: file.name,
          mimeType: file.type === 'image/jpg' ? 'image/jpeg' : file.type,
          data,
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
          isImage,
        }];
      });
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const target = prev.find(a => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(a => a.id !== id);
    });
  };

  /** Release preview URLs and clear the composer's staged attachments (after send). */
  const clearAttachments = () => {
    attachmentsRef.current.forEach(a => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
    setAttachments([]);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!enabled) return;
    const files = Array.from(e.clipboardData.files);
    if (files.length > 0) {
      e.preventDefault();
      void handleFiles(files);
    }
  };

  return { attachments, isDragging, setIsDragging, handleFiles, removeAttachment, clearAttachments, handlePaste };
};
