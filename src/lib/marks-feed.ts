import { create } from "zustand";
import {
  listAllTrackMarks,
  listTrackMarks,
  type TrackMark,
} from "@/lib/marks";

export const EMPTY_MARKS: TrackMark[] = [];

type MarksFeedState = {
  byTrack: Record<string, TrackMark[]>;
  loaded: boolean;
  hydrate: () => Promise<void>;
  hydrateTrack: (trackId: string) => Promise<void>;
  setTrack: (trackId: string, marks: TrackMark[]) => void;
};

function group(rows: TrackMark[]) {
  const next: Record<string, TrackMark[]> = {};
  for (const row of rows) {
    (next[row.trackId] ??= []).push(row);
  }
  return next;
}

export const useMarksFeed = create<MarksFeedState>((set, get) => ({
  byTrack: {},
  loaded: false,
  hydrate: async () => {
    if (get().loaded) return;
    try {
      const rows = await listAllTrackMarks();
      set({ byTrack: group(rows ?? []), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  hydrateTrack: async (trackId) => {
    try {
      const rows = await listTrackMarks({ data: trackId });
      set((state) => ({
        byTrack: { ...state.byTrack, [trackId]: rows ?? EMPTY_MARKS },
      }));
    } catch {
      /* keep what we have */
    }
  },
  setTrack: (trackId, marks) =>
    set((state) => ({
      byTrack: { ...state.byTrack, [trackId]: marks },
    })),
}));
