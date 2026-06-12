import { create } from 'zustand';

interface ToastState {
  message: string | null;
  showToast: (msg: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  showToast: (msg) => {
    set({ message: msg });
    setTimeout(() => set({ message: null }), 2200);
  },
}));
