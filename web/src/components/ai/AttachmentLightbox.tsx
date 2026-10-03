import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import type { ChatMessageAttachment } from '../../services/aiService';

/** Full-screen preview for a sent attachment: image lightbox or inline PDF viewer. */
export const AttachmentLightbox: React.FC<{
  attachment: ChatMessageAttachment;
  onClose: () => void;
}> = ({ attachment, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 sm:p-8"
      onClick={onClose}
    >
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Open in new tab"
          className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        >
          <ExternalLink size={20} />
        </a>
        <button
          onClick={onClose}
          title="Close (Esc)"
          className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        >
          <X size={20} />
        </button>
      </div>
      {attachment.mimeType.startsWith('image/') ? (
        <img
          src={attachment.url}
          alt={attachment.fileName ?? 'attachment'}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        />
      ) : (
        <iframe
          src={attachment.url}
          title={attachment.fileName ?? 'attachment'}
          onClick={(e) => e.stopPropagation()}
          className="h-[90vh] w-full max-w-4xl rounded-lg bg-white shadow-2xl"
        />
      )}
    </div>,
    document.body,
  );
};
