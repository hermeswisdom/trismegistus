/**
 * Client store for explicit offline saves. IndexedDB is the source of truth;
 * object URLs are held in memory for the native <audio> element.
 */
import { create } from "zustand";
import {
  classifySaveError,
  downloadListeningAudio,
  dropOfflineSave,
  estimateOfflineUsage,
  hydrateOfflineSaves,
  idbOfflineBackend,
  indexedDbAvailable,
  openOfflineDb,
  persistOfflineSave,
  saveErrorCopy,
  type OfflineBackend,
  type OfflineSave,
  type OfflineTrackInput,
  type SaveErrorKind,
} from "./offline-library.ts";
import { nativeAdoptLocalSave } from "./native-audio.ts";
import { hasStream } from "./streams.ts";

export type OfflineStatusState = "idle" | "saving" | "saved" | "error";

export type OfflineStatus = {
  state: OfflineStatusState;
  error?: string;
  kind?: SaveErrorKind;
  received?: number;
  total?: number | null;
};

type OfflineStoreState = {
  ready: boolean;
  supported: boolean;
  items: OfflineSave[];
  missing: string[];
  statusBySlug: Record<string, OfflineStatus>;
  usage: { used: number; quota: number | null };
  hydrate: () => Promise<void>;
  save: (track: OfflineTrackInput) => Promise<void>;
  cancel: (slug: string) => void;
  remove: (slug: string) => Promise<void>;
};

const aborts = new Map<string, AbortController>();
let backendPromise: Promise<OfflineBackend> | null = null;
let hydrated = false;

async function getBackend(): Promise<OfflineBackend> {
  if (!indexedDbAvailable()) {
    throw Object.assign(new Error("indexedDB is not supported"), { kind: "unsupported" as const });
  }
  backendPromise ??= openOfflineDb()
    .then(idbOfflineBackend)
    .catch((err) => {
      backendPromise = null;
      throw err;
    });
  return backendPromise;
}

function statusMap(items: OfflineSave[], extra: Record<string, OfflineStatus> = {}): Record<string, OfflineStatus> {
  const next: Record<string, OfflineStatus> = { ...extra };
  for (const row of items) {
    if (!next[row.slug] || next[row.slug]?.state !== "saving") {
      next[row.slug] = { state: "saved" };
    }
  }
  return next;
}

async function refreshUsage(items: OfflineSave[]): Promise<{ used: number; quota: number | null }> {
  const storage = typeof navigator === "undefined" ? null : navigator.storage;
  return estimateOfflineUsage(storage, items);
}

async function fetchCover(image: string, signal: AbortSignal): Promise<Blob | null> {
  if (!image || image.startsWith("blob:") || image.startsWith("data:")) return null;
  try {
    const res = await fetch(image, { signal, cache: "force-cache", credentials: "same-origin" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/") && blob.size === 0) return null;
    return blob;
  } catch {
    return null;
  }
}

export const useOfflineSaves = create<OfflineStoreState>((set, get) => ({
  ready: false,
  supported: true,
  items: [],
  missing: [],
  statusBySlug: {},
  usage: { used: 0, quota: null },

  hydrate: async () => {
    if (typeof window === "undefined") return;
    if (hydrated && get().ready) return;
    if (!indexedDbAvailable()) {
      hydrated = true;
      set({ ready: true, supported: false });
      return;
    }
    try {
      const backend = await getBackend();
      const { items, missing } = await hydrateOfflineSaves(backend);
      const usage = await refreshUsage(items);
      hydrated = true;
      set({
        ready: true,
        supported: true,
        items,
        missing,
        statusBySlug: statusMap(items, get().statusBySlug),
        usage,
      });
    } catch {
      hydrated = true;
      set({ ready: true, supported: false });
    }
  },

  save: async (track) => {
    if (!hasStream(track.slug)) {
      set({
        statusBySlug: {
          ...get().statusBySlug,
          [track.slug]: { state: "error", kind: "no-stream", error: saveErrorCopy("no-stream") },
        },
      });
      return;
    }
    const current = get().statusBySlug[track.slug];
    if (current?.state === "saving") return;
    if (!indexedDbAvailable()) {
      set({
        supported: false,
        statusBySlug: {
          ...get().statusBySlug,
          [track.slug]: { state: "error", kind: "unsupported", error: saveErrorCopy("unsupported") },
        },
      });
      return;
    }

    const abort = new AbortController();
    aborts.get(track.slug)?.abort();
    aborts.set(track.slug, abort);
    set({
      statusBySlug: {
        ...get().statusBySlug,
        [track.slug]: { state: "saving", received: 0, total: null },
      },
    });

    try {
      const audio = await downloadListeningAudio({
        slug: track.slug,
        fetch: (input, init) => fetch(input, init),
        signal: abort.signal,
        onProgress: (received, total) => {
          if (aborts.get(track.slug) !== abort) return;
          set({
            statusBySlug: {
              ...get().statusBySlug,
              [track.slug]: { state: "saving", received, total },
            },
          });
        },
      });
      const cover = await fetchCover(track.image, abort.signal);
      const backend = await getBackend();
      const row = await persistOfflineSave(backend, track, audio, cover);
      if (abort.signal.aborted) {
        await dropOfflineSave(backend, track.slug);
        throw Object.assign(new Error("aborted"), { name: "AbortError", kind: "interrupted" as const });
      }
      const items = [row, ...get().items.filter((item) => item.slug !== row.slug)];
      const usage = await refreshUsage(items);
      aborts.delete(track.slug);
      nativeAdoptLocalSave(track.slug);
      set({
        items,
        missing: get().missing.filter((slug) => slug !== track.slug),
        statusBySlug: { ...get().statusBySlug, [track.slug]: { state: "saved" } },
        usage,
        supported: true,
      });
    } catch (err) {
      aborts.delete(track.slug);
      const kind = classifySaveError(err);
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      if (typeof console !== "undefined") console.warn("[offline-save]", kind, detail);
      if (kind === "interrupted" && get().statusBySlug[track.slug]?.state !== "saving") {
        return;
      }
      try {
        const backend = await getBackend();
        await dropOfflineSave(backend, track.slug);
      } catch {
        /* partial cleanup is best-effort */
      }
      set({
        items: get().items.filter((item) => item.slug !== track.slug),
        statusBySlug: {
          ...get().statusBySlug,
          [track.slug]: {
            state: "error",
            kind,
            error: kind === "unknown" ? `${saveErrorCopy(kind)} (${detail})` : saveErrorCopy(kind),
          },
        },
      });
    }
  },

  cancel: (slug) => {
    const abort = aborts.get(slug);
    if (!abort) return;
    abort.abort();
    aborts.delete(slug);
    set({
      statusBySlug: {
        ...get().statusBySlug,
        [slug]: { state: "error", kind: "interrupted", error: saveErrorCopy("interrupted") },
      },
    });
  },

  remove: async (slug) => {
    get().cancel(slug);
    try {
      const backend = await getBackend();
      await dropOfflineSave(backend, slug);
    } catch {
      /* still drop from the UI */
    }
    const items = get().items.filter((item) => item.slug !== slug);
    const usage = await refreshUsage(items);
    const statusBySlug = { ...get().statusBySlug };
    delete statusBySlug[slug];
    set({ items, usage, statusBySlug, missing: get().missing.filter((s) => s !== slug) });
  },
}));

export function resetOfflineStoreForTests(): void {
  hydrated = false;
  backendPromise = null;
  for (const abort of aborts.values()) abort.abort();
  aborts.clear();
  useOfflineSaves.setState({
    ready: false,
    supported: true,
    items: [],
    missing: [],
    statusBySlug: {},
    usage: { used: 0, quota: null },
  });
}

export function savedOfflineSlugs(): ReadonlySet<string> {
  return new Set(useOfflineSaves.getState().items.map((row) => row.slug));
}
