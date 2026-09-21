import { create } from "zustand";
import type { PlayRow, RecentMark } from "@/lib/plays";

type PlayBoardState = {
  rows: PlayRow[];
  recent: RecentMark[];
  setRows: (rows: PlayRow[]) => void;
  setBoard: (rows: PlayRow[], recent: RecentMark[]) => void;
};

export const usePlayBoard = create<PlayBoardState>((set) => ({
  rows: [],
  recent: [],
  setRows: (rows) => set({ rows }),
  setBoard: (rows, recent) => set({ rows, recent }),
}));
