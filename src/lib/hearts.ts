import { create } from "zustand";
import { heartMapFromIds, idsFromHeartMap } from "@/lib/favorites-sync";

const KEY = "trismegistus-hearts";

type HeartsState = {
  ids: Record<string, true>;
  ready: boolean;
  hydrate: () => void;
  replace: (ids: readonly string[]) => void;
  toggle: (id: string) => boolean;
};

function readStored(): Record<string, true> {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return heartMapFromIds(Array.isArray(list) ? list : []);
  } catch {
    return {};
  }
}

function persist(ids: Record<string, true>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(idsFromHeartMap(ids)));
  } catch {
    /* private mode */
  }
}

export const useHearts = create<HeartsState>((set, get) => ({
  ids: {},
  ready: false,
  hydrate: () => {
    if (typeof window === "undefined" || get().ready) return;
    set({ ids: readStored(), ready: true });
  },
  replace: (ids) => {
    const next = heartMapFromIds(ids);
    set({ ids: next, ready: true });
    persist(next);
  },
  toggle: (id) => {
    const next = { ...get().ids };
    let liked = false;
    if (next[id]) delete next[id];
    else {
      next[id] = true;
      liked = true;
    }
    set({ ids: next, ready: true });
    persist(next);
    return liked;
  },
}));
