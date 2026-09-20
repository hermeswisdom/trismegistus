import { create } from "zustand";
import type { PlayRow } from "@/lib/plays";

type PlayBoardState = {
  rows: PlayRow[];
  setRows: (rows: PlayRow[]) => void;
};

export const usePlayBoard = create<PlayBoardState>((set) => ({
  rows: [],
  setRows: (rows) => set({ rows }),
}));
