import type { ReactNode } from 'react';

interface ModalOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function ModalOverlay({ isOpen, onClose, children }: ModalOverlayProps) {
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay active"
      onClick={onClose}
    >
      {children}
    </div>
  );
}
