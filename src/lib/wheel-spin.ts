import { create } from "zustand";

type WheelSpinState = {
  nonce: number;
  winnerId: string | null;
  busy: boolean;
  begin: (winnerId: string, opts?: { force?: boolean }) => boolean;
  finish: () => void;
};

export const useWheelSpin = create<WheelSpinState>((set, get) => ({
  nonce: 0,
  winnerId: null,
  busy: false,
  begin: (winnerId, opts) => {
    if (get().busy && !opts?.force) return false;
    set((s) => ({ nonce: s.nonce + 1, winnerId, busy: true }));
    return true;
  },
  finish: () => set({ busy: false }),
}));
