import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

interface DeleteModalProps {
  isOpen: boolean;
  title?: string;
  itemName?: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDeleting?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  isOpen,
  title = 'Delete item',
  itemName,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isDeleting = false,
  onClose,
  onConfirm,
}) => {
  const handleClose = () => {
    if (!isDeleting) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} className="max-w-md">
      <div className="space-y-5">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-sm leading-6 text-zinc-600">
              {description ?? (
                <>
                  Are you sure you want to delete{' '}
                  {itemName ? (
                    <span className="font-semibold text-zinc-800 break-words">"{itemName}"</span>
                  ) : (
                    'this item'
                  )}
                  ? This action cannot be undone.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isDeleting}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} isLoading={isDeleting}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
