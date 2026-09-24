import { create } from 'zustand';
import { publishLunarisSidePetState } from '@/config/lunarisPetStates';

interface ToastState {
  message: string | null;
  showToast: (msg: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  showToast: (msg) => {
    set({ message: msg });
    if (/錯誤|失敗|警告|異常|error|failed|warning/i.test(msg)) {
      publishLunarisSidePetState('miniAlert');
    } else if (/儲存|保存|完成|成功|新增|收錄|已收錄|saved|success|complete/i.test(msg)) {
      publishLunarisSidePetState('miniHappy');
    }
    setTimeout(() => set({ message: null }), 2200);
  },
}));
