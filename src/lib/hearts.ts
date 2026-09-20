import { create } from "zustand";

const KEY = "trismegistus-hearts";

type HeartsState = {
  ids: Record<string, true>;
  ready: boolean;
  hydrate: () => void;
  toggle: (id: string) => void;
};

function readStored(): Record<string, true> {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return Object.fromEntries(list.map((id) => [id, true as const]));
  } catch {
    return {};
  }
}

export const useHearts = create<HeartsState>((set, get) => ({
  ids: {},
  ready: false,
  hydrate: () => {
    if (typeof window === "undefined" || get().ready) return;
    set({ ids: readStored(), ready: true });
  },
  toggle: (id) => {
    const next = { ...get().ids };
    if (next[id]) delete next[id];
    else next[id] = true;
    set({ ids: next });
    try {
      localStorage.setItem(KEY, JSON.stringify(Object.keys(next)));
    } catch {
      /* private mode */
    }
  },
}));
