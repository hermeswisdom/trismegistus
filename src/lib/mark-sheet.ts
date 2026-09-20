import { create } from "zustand";

type MarkSheetState = {
  trackId: string | null;
  open: (trackId: string) => void;
  close: () => void;
};

export const useMarkSheet = create<MarkSheetState>((set) => ({
  trackId: null,
  open: (trackId) => set({ trackId }),
  close: () => set({ trackId: null }),
}));
