import { SOUNDCLOUD_TRACKS } from "./soundcloud-tracks.ts";
import type { Track } from "./rooms.ts";

/** Confirmed Atman price: 99 pence GBP per raw master. */
export const DEFAULT_MASTER_PRICE_PENCE = 99;
export const MASTER_CURRENCY = "gbp";
export const MASTER_LICENSE_LINE = "Raw master MP3 · personal use";
export const MASTER_BLOB_PREFIX = "masters/";
export const DOWNLOAD_TTL_MS = 48 * 60 * 60 * 1000;
export const DOWNLOAD_LINK_TTL_MS = 10 * 60 * 1000;
export const MAX_MASTER_DOWNLOADS = 8;
export const FIXTURE_TRACK_ID = "the-sleepers-waking";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MASTER_KEY_RE = /^masters\/[a-z0-9]+(?:-[a-z0-9]+)*\.mp3$/;

export function defaultMasterDownloadKey(slug: string): string {
  if (!SLUG_RE.test(slug)) {
    throw new Error(`invalid master slug: ${slug}`);
  }
  return `${MASTER_BLOB_PREFIX}${slug}.mp3`;
}

/** Every catalog id → default private Blob path. Sale still needs `downloadKey`. */
export function catalogMasterPaths(
  tracks: readonly { id: string; slug: string }[] = SOUNDCLOUD_TRACKS,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const track of tracks) {
    out[track.id] = defaultMasterDownloadKey(track.slug);
  }
  return out;
}

export function sanitizeMasterDownloadKey(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const key = value.trim();
  return MASTER_KEY_RE.test(key) ? key : undefined;
}

export function saleDownloadKey(track: Pick<Track, "downloadKey" | "slug">): string | undefined {
  return sanitizeMasterDownloadKey(track.downloadKey);
}

export function trackIsForSale(track: Pick<Track, "downloadKey" | "slug">): boolean {
  return Boolean(saleDownloadKey(track));
}

function catalogTracks(tracks?: readonly Track[]): readonly Track[] {
  return tracks ?? (SOUNDCLOUD_TRACKS as Track[]);
}

export function findCatalogTrack(
  idOrSlug: string,
  tracks?: readonly Track[],
): Track | undefined {
  return catalogTracks(tracks).find(
    (track) => track.id === idOrSlug || track.slug === idOrSlug,
  );
}

export function saleTrack(idOrSlug: string, tracks?: readonly Track[]): Track | undefined {
  const track = findCatalogTrack(idOrSlug, tracks);
  if (!track || !trackIsForSale(track)) return undefined;
  return track;
}

export function saleTracks(tracks?: readonly Track[]): Track[] {
  return catalogTracks(tracks).filter(trackIsForSale);
}

export function masterPricePence(raw?: string): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isFinite(parsed) && parsed >= 50 && parsed <= 2000) return parsed;
  return DEFAULT_MASTER_PRICE_PENCE;
}

export function formatMasterPrice(pence = DEFAULT_MASTER_PRICE_PENCE): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export function masterBuyLabel(pence = DEFAULT_MASTER_PRICE_PENCE): string {
  return `Download MP3 · ${formatMasterPrice(pence)}`;
}

export function masterFilename(track: Pick<Track, "title" | "slug">): string {
  const stem =
    track.title.replace(/[^\p{L}\p{N}\s'-]+/gu, "").replace(/\s+/g, " ").trim() ||
    track.slug;
  return `${stem} — Atman Music.mp3`;
}

export function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7E]+/g, "_").replace(/"/g, "");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export function parseSaleSlugs(raw: string | undefined): Set<string> | "all" | undefined {
  if (!raw?.trim()) return undefined;
  const parts = raw.split(/[\s,]+/).map((part) => part.trim()).filter(Boolean);
  if (parts.includes("*") || parts.includes("all")) return "all";
  return new Set(parts);
}

/** Server-side extra enablement: MASTER_SALE_SLUGS=slug1,slug2 or * */
export function resolveSaleDownloadKey(
  track: Track,
  extraSlugs?: Set<string> | "all",
): string | undefined {
  const explicit = saleDownloadKey(track);
  if (explicit) return explicit;
  if (extraSlugs === "all" || extraSlugs?.has(track.slug) || extraSlugs?.has(track.id)) {
    return defaultMasterDownloadKey(track.slug);
  }
  return undefined;
}

export function dryRunSessionId(trackId: string, nonce = randomNonce(8)): string {
  return `dry_${trackId}_${nonce}`;
}

export function isDryRunSessionId(sessionId: string): boolean {
  return sessionId.startsWith("dry_");
}

export function trackIdFromDryRunSession(sessionId: string): string | undefined {
  const match = /^dry_([a-z0-9]+(?:-[a-z0-9]+)*)_[a-f0-9]+$/i.exec(sessionId);
  return match?.[1];
}

export function randomNonce(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function purchaseExpiryIso(paidAt = new Date(), ttlMs = DOWNLOAD_TTL_MS): string {
  return new Date(paidAt.getTime() + ttlMs).toISOString();
}

export function displayMasterPricePence(): number {
  const raw =
    typeof import.meta !== "undefined"
      ? (import.meta as { env?: { VITE_MASTER_PRICE_PENCE?: string } }).env
          ?.VITE_MASTER_PRICE_PENCE
      : undefined;
  return masterPricePence(raw);
}
