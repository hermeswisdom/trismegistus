import { create } from "zustand";
import type { PlayRow, RecentMark } from "@/lib/plays";

type PlayBoardState = {
  rows: PlayRow[];
  recent: RecentMark[];
  namedMarks: RecentMark[];
  setRows: (rows: PlayRow[]) => void;
  setBoard: (rows: PlayRow[], recent: RecentMark[]) => void;
  noteTabletMark: (trackId: string) => void;
};

export const usePlayBoard = create<PlayBoardState>((set) => ({
  rows: [],
  recent: [],
  namedMarks: [],
  setRows: (rows) => set({ rows }),
  setBoard: (rows, recent) => set({ rows, recent }),
  noteTabletMark: (trackId) =>
    set((state) => ({
      namedMarks: [
        { trackId, createdAt: new Date().toISOString(), mine: true },
        ...state.namedMarks.filter((mark) => mark.trackId !== trackId),
      ].slice(0, 8),
    })),
}));

/** Named tablet comments first (private), then anonymous listen marks. */
export function selectRoomPulse(state: Pick<PlayBoardState, "namedMarks" | "recent">) {
  return [...state.namedMarks, ...state.recent].slice(0, 12);
}
