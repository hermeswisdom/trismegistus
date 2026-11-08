/**
 * Explicit offline listening copies. Visitors tap Save offline on one tablet
 * at a time; the 128 kbps wall stream is stored in IndexedDB on this device
 * and this browser. Paid masters (masters/, /api/masters, /download) are
 * never fetched or stored. Auto Mix HQ (streams-hq/) is not saved either.
 *
 * Playback uses blob: URLs so seeking is handled by the media element, not
 * by a service worker Range implementation. The SW (public/sw.js) only
 * serves a public offline shell plus static assets — never these blobs.
 */
import { STREAM_BITRATE_KBPS } from "./stream-manifest.ts";
import { hasStream, streamUrl } from "./streams.ts";

export const OFFLINE_DB_NAME = "atman-offline";
export const OFFLINE_DB_VERSION = 1;
export const OFFLINE_SAVES_STORE = "saves";
export const OFFLINE_AUDIO_STORE = "audio";
export const OFFLINE_COVERS_STORE = "covers";

export const OFFLINE_BITRATE_KBPS = STREAM_BITRATE_KBPS;

export type OfflineSave = {
  slug: string;
  id: string;
  title: string;
  image: string;
  bytes: number;
  contentType: string;
  savedAt: number;
  bitrateKbps: number;
};

export type SaveErrorKind =
  | "unsupported"
  | "no-stream"
  | "quota"
  | "network"
  | "interrupted"
  | "forbidden"
  | "missing"
  | "evicted"
  | "unknown";

export type OfflineTrackInput = {
  id: string;
  slug: string;
  title: string;
  image: string;
};

const objectUrls = new Map<string, string>();

export function peekOfflineObjectUrl(slug: string): string | null {
  return objectUrls.get(slug) ?? null;
}

export function rememberOfflineObjectUrl(slug: string, blob: Blob): string {
  const prev = objectUrls.get(slug);
  if (prev) URL.revokeObjectURL(prev);
  const url = URL.createObjectURL(blob);
  objectUrls.set(slug, url);
  return url;
}

export function forgetOfflineObjectUrl(slug: string): void {
  const prev = objectUrls.get(slug);
  if (prev) URL.revokeObjectURL(prev);
  objectUrls.delete(slug);
}

export function resetOfflineObjectUrlsForTests(): void {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
}

export function indexedDbAvailable(
  idb: unknown = typeof indexedDB === "undefined" ? undefined : indexedDB,
): boolean {
  return Boolean(idb && typeof (idb as IDBFactory).open === "function");
}

export function classifySaveError(err: unknown): SaveErrorKind {
  if (!err) return "unknown";
  if (typeof err === "string") {
    if (err === "unsupported" || err === "no-stream" || err === "quota" || err === "network" || err === "interrupted" || err === "forbidden" || err === "missing" || err === "evicted") {
      return err;
    }
    return "unknown";
  }
  const name = (err as { name?: string }).name ?? "";
  const message = (err as { message?: string }).message ?? "";
  const kind = (err as { kind?: SaveErrorKind }).kind;
  if (kind) return kind;
  if (name === "AbortError" || /abort/i.test(message)) return "interrupted";
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || (err as { code?: number }).code === 22) {
    return "quota";
  }
  if (name === "UnsupportedError" || /indexedDB|not supported/i.test(message)) return "unsupported";
  if (name === "TypeError" && /failed to fetch|networkerror|load failed/i.test(message)) return "network";
  if (/stream unavailable|failed to fetch/i.test(message)) return "network";
  if (/forbidden|master/i.test(message)) return "forbidden";
  if (/no stream/i.test(message)) return "no-stream";
  return "unknown";
}

export function saveErrorCopy(kind: SaveErrorKind): string {
  switch (kind) {
    case "unsupported":
      return "This browser can't save songs offline.";
    case "no-stream":
      return "This tablet has no listening stream to save.";
    case "quota":
      return "Not enough space on this device.";
    case "network":
      return "Couldn't save. Go online and try again.";
    case "interrupted":
      return "Save interrupted. Try again.";
    case "forbidden":
      return "That file isn't a listening stream.";
    case "missing":
    case "evicted":
      return "This save was cleared from the device. Save it again while you're online.";
    default:
      return "Couldn't save this tablet.";
  }
}

/** Decimal megabytes, one place — same convention as the ebook helper. */
export function formatOfflineBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(bytes < 10_000 ? 1 : 0)} kB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function formatStorageLine(opts: { used: number; quota: number | null; count: number }): string {
  const files = opts.count === 1 ? "1 song" : `${opts.count} songs`;
  const used = formatOfflineBytes(opts.used);
  if (opts.quota && opts.quota > 0) {
    return `${files} · ${used} of about ${formatOfflineBytes(opts.quota)} on this device`;
  }
  return `${files} · about ${used} on this device`;
}

function pathOf(url: string): string {
  try {
    return new URL(url, "https://atmanmusic.app").pathname;
  } catch {
    return url;
  }
}

/**
 * Paths we must never treat as a listening copy. HQ Auto Mix files and the
 * paid master pipeline stay out.
 */
export function isForbiddenOfflineSource(url: string): boolean {
  const p = pathOf(url).toLowerCase();
  if (p.includes("/masters/")) return true;
  if (p.includes("/api/masters")) return true;
  if (p.includes("/api/stripe")) return true;
  if (p.includes("/download")) return true;
  if (p.includes("/admin")) return true;
  if (p.includes("/api/auth")) return true;
  if (p.includes("/media/streams-hq/")) return true;
  if (p.includes("/streams-hq/")) return true;
  return false;
}

/** Final (or requested) URL of a listening-quality stream we are allowed to save. */
export function isAllowedOfflineSource(url: string): boolean {
  if (isForbiddenOfflineSource(url)) return false;
  const p = pathOf(url).toLowerCase();
  if (/^\/api\/stream\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p)) return true;
  if (/^\/media\/streams\/[a-z0-9]+(?:-[a-z0-9]+)*\.mp3$/.test(p)) return true;
  if (/\/streams\/[a-z0-9]+(?:-[a-z0-9]+)*\.mp3$/.test(p)) return true;
  return false;
}

export function looksLikeAudio(contentType: string | null | undefined, url: string): boolean {
  const t = (contentType ?? "").toLowerCase();
  if (t.includes("text/html") || t.includes("application/json") || t.includes("text/plain")) return false;
  if (t.includes("audio/") || t.includes("mpeg") || t.includes("mp3") || t.includes("octet-stream")) return true;
  if (!t && /\.mp3(?:$|\?)/i.test(url)) return true;
  return false;
}

export function listeningStreamPath(slug: string): string | null {
  if (!hasStream(slug)) return null;
  return streamUrl(slug);
}

/** Why Save offline is tappable, or why it must stay visible but disabled. */
export type SaveOfflineGate = "ready" | "no-stream" | "unsupported";

export function saveOfflineGate(slug: string, supported: boolean): SaveOfflineGate {
  if (!supported) return "unsupported";
  if (!hasStream(slug)) return "no-stream";
  return "ready";
}

function taggedError(kind: SaveErrorKind, message: string): Error {
  return Object.assign(new Error(message), { kind, name: kind === "interrupted" ? "AbortError" : "Error" });
}

export async function downloadListeningAudio(opts: {
  slug: string;
  fetch: typeof fetch;
  signal?: AbortSignal;
  onProgress?: (received: number, total: number | null) => void;
}): Promise<{ blob: Blob; bytes: number; contentType: string; finalUrl: string }> {
  const path = listeningStreamPath(opts.slug);
  if (!path) throw taggedError("no-stream", "no stream");
  if (opts.signal?.aborted) throw taggedError("interrupted", "aborted");

  let res: Response;
  try {
    // window.fetch extracted as a value is an illegal invocation in Chromium.
    const doFetch = (opts.fetch ?? globalThis.fetch).bind(globalThis);
    res = await doFetch(path, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      credentials: "same-origin",
      signal: opts.signal,
      headers: { Accept: "audio/mpeg, audio/*, application/octet-stream" },
    });
  } catch (err) {
    throw Object.assign(err instanceof Error ? err : new Error(String(err)), {
      kind: classifySaveError(err),
    });
  }

  const finalUrl = res.url || path;
  if (isForbiddenOfflineSource(finalUrl) || !isAllowedOfflineSource(finalUrl)) {
    throw taggedError("forbidden", "forbidden source");
  }
  if (!res.ok) {
    throw taggedError("network", `stream unavailable (${res.status})`);
  }
  const contentType = res.headers.get("content-type") || "audio/mpeg";
  if (!looksLikeAudio(contentType, finalUrl)) {
    throw taggedError("forbidden", "not audio");
  }

  const totalHeader = res.headers.get("content-length");
  const total = totalHeader ? Number(totalHeader) : NaN;
  const knownTotal = Number.isFinite(total) && total > 0 ? total : null;
  // Prefer arrayBuffer(): intercepted/streamed bodies can detach Uint8Array
  // chunks, and bytes.set() on a detached buffer throws a TypeError. Copy
  // immediately so the Blob we persist is a standalone listening file.
  let bytes: Uint8Array;
  try {
    const buffer = await res.arrayBuffer();
    bytes = new Uint8Array(buffer.byteLength);
    bytes.set(new Uint8Array(buffer));
    opts.onProgress?.(bytes.byteLength, knownTotal ?? bytes.byteLength);
  } catch (err) {
    if (opts.signal?.aborted) throw taggedError("interrupted", "aborted");
    throw Object.assign(err instanceof Error ? err : new Error(String(err)), {
      kind: classifySaveError(err),
    });
  }
  if (opts.signal?.aborted) throw taggedError("interrupted", "aborted");
  if (!bytes.byteLength) throw taggedError("network", "stream unavailable (empty body)");
  const type = contentType.split(";")[0]?.trim() || "audio/mpeg";
  const copy = bytes.slice();
  return {
    blob: new Blob([copy], { type }),
    bytes: copy.byteLength,
    contentType: type,
    finalUrl,
  };
}

export type OfflineBackend = {
  getMeta(slug: string): Promise<OfflineSave | undefined>;
  listMeta(): Promise<OfflineSave[]>;
  putMeta(row: OfflineSave): Promise<void>;
  deleteMeta(slug: string): Promise<void>;
  getAudio(slug: string): Promise<Blob | undefined>;
  putAudio(slug: string, blob: Blob): Promise<void>;
  deleteAudio(slug: string): Promise<void>;
  getCover(slug: string): Promise<Blob | undefined>;
  putCover(slug: string, blob: Blob): Promise<void>;
  deleteCover(slug: string): Promise<void>;
};

export function memoryOfflineBackend(): OfflineBackend & {
  meta: Map<string, OfflineSave>;
  audio: Map<string, Blob>;
  covers: Map<string, Blob>;
} {
  const meta = new Map<string, OfflineSave>();
  const audio = new Map<string, Blob>();
  const covers = new Map<string, Blob>();
  return {
    meta,
    audio,
    covers,
    async getMeta(slug) {
      return meta.get(slug);
    },
    async listMeta() {
      return [...meta.values()].sort((a, b) => b.savedAt - a.savedAt);
    },
    async putMeta(row) {
      meta.set(row.slug, row);
    },
    async deleteMeta(slug) {
      meta.delete(slug);
    },
    async getAudio(slug) {
      return audio.get(slug);
    },
    async putAudio(slug, blob) {
      audio.set(slug, blob);
    },
    async deleteAudio(slug) {
      audio.delete(slug);
    },
    async getCover(slug) {
      return covers.get(slug);
    },
    async putCover(slug, blob) {
      covers.set(slug, blob);
    },
    async deleteCover(slug) {
      covers.delete(slug);
    },
  };
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb"));
  });
}

function idbTxDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb tx"));
    tx.onabort = () => reject(tx.error ?? taggedError("interrupted", "aborted"));
  });
}

export async function openOfflineDb(
  factory: IDBFactory | null | undefined = typeof indexedDB === "undefined" ? undefined : indexedDB,
): Promise<IDBDatabase> {
  if (!factory) throw taggedError("unsupported", "indexedDB is not supported");
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = factory.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    } catch (err) {
      reject(Object.assign(err instanceof Error ? err : new Error(String(err)), { kind: "unsupported" as const }));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OFFLINE_SAVES_STORE)) {
        db.createObjectStore(OFFLINE_SAVES_STORE, { keyPath: "slug" });
      }
      if (!db.objectStoreNames.contains(OFFLINE_AUDIO_STORE)) {
        db.createObjectStore(OFFLINE_AUDIO_STORE);
      }
      if (!db.objectStoreNames.contains(OFFLINE_COVERS_STORE)) {
        db.createObjectStore(OFFLINE_COVERS_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? taggedError("unsupported", "indexedDB open failed"));
  });
}

/** IDB may hand back a Blob, ArrayBuffer, or typed array depending on the browser. */
export function coerceAudioBlob(raw: unknown, contentType = "audio/mpeg"): Blob | undefined {
  if (raw instanceof Blob) return raw.size > 0 ? raw : undefined;
  if (raw instanceof ArrayBuffer) {
    return raw.byteLength > 0 ? new Blob([raw], { type: contentType }) : undefined;
  }
  if (raw instanceof Uint8Array && raw.byteLength > 0) {
    const copy = new Uint8Array(raw.byteLength);
    copy.set(raw);
    return new Blob([copy], { type: contentType });
  }
  return undefined;
}

export function idbOfflineBackend(db: IDBDatabase): OfflineBackend {
  const rw = (...stores: string[]) => db.transaction(stores, "readwrite");
  const ro = (...stores: string[]) => db.transaction(stores, "readonly");
  return {
    async getMeta(slug) {
      const tx = ro(OFFLINE_SAVES_STORE);
      const row = await idbRequest(tx.objectStore(OFFLINE_SAVES_STORE).get(slug));
      await idbTxDone(tx).catch(() => undefined);
      return row as OfflineSave | undefined;
    },
    async listMeta() {
      const tx = ro(OFFLINE_SAVES_STORE);
      const rows = (await idbRequest(tx.objectStore(OFFLINE_SAVES_STORE).getAll())) as OfflineSave[];
      await idbTxDone(tx).catch(() => undefined);
      return [...rows].sort((a, b) => b.savedAt - a.savedAt);
    },
    async putMeta(row) {
      const tx = rw(OFFLINE_SAVES_STORE);
      const done = idbTxDone(tx);
      await idbRequest(tx.objectStore(OFFLINE_SAVES_STORE).put(row));
      await done;
    },
    async deleteMeta(slug) {
      const tx = rw(OFFLINE_SAVES_STORE);
      tx.objectStore(OFFLINE_SAVES_STORE).delete(slug);
      await idbTxDone(tx);
    },
    async getAudio(slug) {
      const tx = ro(OFFLINE_AUDIO_STORE);
      const done = idbTxDone(tx).catch(() => undefined);
      const raw = await idbRequest(tx.objectStore(OFFLINE_AUDIO_STORE).get(slug));
      await done;
      return coerceAudioBlob(raw);
    },
    async putAudio(slug, blob) {
      const tx = rw(OFFLINE_AUDIO_STORE);
      const done = idbTxDone(tx);
      const req = tx.objectStore(OFFLINE_AUDIO_STORE).put(blob, slug);
      await idbRequest(req);
      await done;
    },
    async deleteAudio(slug) {
      const tx = rw(OFFLINE_AUDIO_STORE);
      tx.objectStore(OFFLINE_AUDIO_STORE).delete(slug);
      await idbTxDone(tx);
    },
    async getCover(slug) {
      const tx = ro(OFFLINE_COVERS_STORE);
      const blob = await idbRequest(tx.objectStore(OFFLINE_COVERS_STORE).get(slug));
      await idbTxDone(tx).catch(() => undefined);
      return blob instanceof Blob ? blob : undefined;
    },
    async putCover(slug, blob) {
      const tx = rw(OFFLINE_COVERS_STORE);
      tx.objectStore(OFFLINE_COVERS_STORE).put(blob, slug);
      await idbTxDone(tx);
    },
    async deleteCover(slug) {
      const tx = rw(OFFLINE_COVERS_STORE);
      tx.objectStore(OFFLINE_COVERS_STORE).delete(slug);
      await idbTxDone(tx);
    },
  };
}

export async function persistOfflineSave(
  backend: OfflineBackend,
  track: OfflineTrackInput,
  audio: { blob: Blob; bytes: number; contentType: string },
  cover?: Blob | null,
): Promise<OfflineSave> {
  const row: OfflineSave = {
    slug: track.slug,
    id: track.id,
    title: track.title,
    image: track.image,
    bytes: audio.bytes,
    contentType: audio.contentType,
    savedAt: Date.now(),
    bitrateKbps: OFFLINE_BITRATE_KBPS,
  };
  try {
    await backend.putAudio(track.slug, audio.blob);
    if (cover) {
      try {
        await backend.putCover(track.slug, cover);
      } catch {
        /* cover is optional */
      }
    }
    await backend.putMeta(row);
  } catch (err) {
    await backend.deleteAudio(track.slug).catch(() => undefined);
    await backend.deleteCover(track.slug).catch(() => undefined);
    await backend.deleteMeta(track.slug).catch(() => undefined);
    throw err;
  }
  rememberOfflineObjectUrl(track.slug, audio.blob);
  return row;
}

export async function dropOfflineSave(backend: OfflineBackend, slug: string): Promise<void> {
  forgetOfflineObjectUrl(slug);
  await Promise.all([
    backend.deleteAudio(slug).catch(() => undefined),
    backend.deleteCover(slug).catch(() => undefined),
    backend.deleteMeta(slug).catch(() => undefined),
  ]);
}

export type HydratedOffline = {
  items: OfflineSave[];
  missing: string[];
};

/**
 * Rebuild object URLs from IDB. A meta row without audio is treated as
 * browser eviction: drop it and report the slug so the UI can tell the truth.
 */
export async function hydrateOfflineSaves(backend: OfflineBackend): Promise<HydratedOffline> {
  const listed = await backend.listMeta();
  const items: OfflineSave[] = [];
  const missing: string[] = [];
  for (const row of listed) {
    const blob = await backend.getAudio(row.slug);
    if (!blob || blob.size === 0) {
      missing.push(row.slug);
      await dropOfflineSave(backend, row.slug);
      continue;
    }
    rememberOfflineObjectUrl(row.slug, blob);
    items.push({ ...row, bytes: blob.size });
  }
  return { items, missing };
}

export async function estimateOfflineUsage(
  storage: { estimate?: () => Promise<{ usage?: number; quota?: number } | undefined> } | null | undefined,
  items: readonly OfflineSave[],
): Promise<{ used: number; quota: number | null }> {
  const fallback = items.reduce((sum, row) => sum + (row.bytes || 0), 0);
  try {
    const estimate = await storage?.estimate?.();
    const used = typeof estimate?.usage === "number" ? estimate.usage : fallback;
    const quota = typeof estimate?.quota === "number" ? estimate.quota : null;
    return { used, quota };
  } catch {
    return { used: fallback, quota: null };
  }
}

/** Do not write play counts, heartbeats, or checkout while the browser is offline. */
export function shouldRecordListen(opts: { online: boolean | undefined; qc: boolean }): boolean {
  if (opts.qc) return false;
  if (opts.online === false) return false;
  return true;
}

export const OFFLINE_DEVICE_NOTE =
  "Saves live on this device and this browser only. They are a listening copy (128 kbps), not the £0.99 master, and the browser may clear them.";
