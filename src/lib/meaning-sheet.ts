import { create } from "zustand";

type MeaningSheetState = {
  trackId: string | null;
  open: (trackId: string) => void;
  close: () => void;
};

export const useMeaningSheet = create<MeaningSheetState>((set) => ({
  trackId: null,
  open: (trackId) => set({ trackId }),
  close: () => set({ trackId: null }),
}));
