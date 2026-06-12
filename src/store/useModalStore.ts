import { create } from 'zustand';
import type { ModalId } from '@/types';

export type SheetKind = 'todo' | 'mood';

interface ModalState {
  activeModal: ModalId | null;
  activeSheet: SheetKind | null;
  openModal: (id: ModalId) => void;
  closeModal: () => void;
  openSheet: (kind: SheetKind) => void;
  closeSheet: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  activeModal: null,
  activeSheet: null,
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
  openSheet: (kind) => set({ activeModal: null, activeSheet: kind }),
  closeSheet: () => set({ activeSheet: null }),
}));
