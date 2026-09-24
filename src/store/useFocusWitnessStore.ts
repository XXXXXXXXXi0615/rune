import { create } from 'zustand';

function load(k: string, fallback: boolean): boolean {
  try { return localStorage.getItem(k) !== 'false'; } catch { return fallback; }
}
function save(k: string, v: boolean) {
  try { localStorage.setItem(k, v ? 'true' : 'false'); } catch {}
}

interface FocusWitnessStore {
  witnessEnabled: boolean;
  allowRecall: boolean;
  setWitnessEnabled: (v: boolean) => void;
  setAllowRecall: (v: boolean) => void;
}

export const useFocusWitnessStore = create<FocusWitnessStore>((set, get) => ({
  witnessEnabled: load('clawd_witness_enabled', true),
  allowRecall: load('clawd_allow_recall', true),
  setWitnessEnabled: (v) => { save('clawd_witness_enabled', v); if (!v) { save('clawd_allow_recall', false); set({ witnessEnabled: false, allowRecall: false }); } else { set({ witnessEnabled: true }); } },
  setAllowRecall: (v) => { save('clawd_allow_recall', v); set({ allowRecall: v }); },
}));
