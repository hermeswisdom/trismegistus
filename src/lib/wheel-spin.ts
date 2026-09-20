import { create } from "zustand";

type WheelSpinState = {
  nonce: number;
  requestSpin: () => void;
};

export const useWheelSpin = create<WheelSpinState>((set) => ({
  nonce: 0,
  requestSpin: () => set((s) => ({ nonce: s.nonce + 1 })),
}));
