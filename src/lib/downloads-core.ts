import type { Track } from "./rooms.ts";

/** Scaffolding default when `TRACK_DOWNLOAD_PRICE_GBP` / `VITE_` override is unset. */
export const DEFAULT_DOWNLOAD_PRICE_GBP = 1.99;
export const DEFAULT_DOWNLOAD_TTL_HOURS = 48;
export const DEFAULT_DOWNLOAD_MAX_USES = 6;
export const DOWNLOAD_LEGAL = "Raw master MP3 · personal use";

export function parsePriceGbp(
  raw: string | undefined,
  fallback = DEFAULT_DOWNLOAD_PRICE_GBP,
): number {
  if (!raw?.trim()) return fallback;
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n <= 0 || n > 999) return fallback;
  return Math.round(n * 100) / 100;
}

export function priceToPence(gbp: number): number {
  return Math.round(gbp * 100);
}

export function formatGbp(gbp: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(gbp);
}

export function displayDownloadPriceGbp(): number {
  const vite = (
    import.meta as ImportMeta & { env?: Record<string, string | undefined> }
  ).env?.VITE_TRACK_DOWNLOAD_PRICE_GBP;
  return parsePriceGbp(vite);
}

export function trackHasMaster(
  track: Pick<Track, "downloadKey"> | null | undefined,
): track is Track & { downloadKey: string } {
  return Boolean(track?.downloadKey?.trim());
}

/** Blob pathname for a configured master. Accepts slug, `file.mp3`, or `masters/…`. */
export function masterBlobPath(downloadKey: string): string {
  const trimmed = downloadKey.trim().replace(/^\/+/, "");
  if (!trimmed) return "masters/unknown.mp3";
  if (trimmed.startsWith("masters/")) {
    return trimmed.endsWith(".mp3") ? trimmed : `${trimmed}.mp3`;
  }
  return trimmed.endsWith(".mp3")
    ? `masters/${trimmed}`
    : `masters/${trimmed}.mp3`;
}

export function downloadFilename(track: Pick<Track, "slug" | "title">): string {
  const slug = track.slug.trim() || "atman-track";
  return `${slug}.mp3`;
}

export function getSellableTrack(
  trackId: string,
  tracks: readonly Track[],
): Track | undefined {
  const track = tracks.find((item) => item.id === trackId);
  return trackHasMaster(track) ? track : undefined;
}

export function parsePriceIdMap(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.startsWith("price_")) {
        out[key] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
): number {
  if (!raw?.trim()) return fallback;
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n <= 0 || n > 10_000) return fallback;
  return n;
}

export function checkoutIntegrationId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let suffix = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length];
  return `atman-mp3-${suffix}`;
}

export function isDryRunSessionId(sessionId: string): boolean {
  return sessionId.startsWith("dry_");
}

export function allowDryRunDownloads(
  environ: Record<string, string | undefined> = process.env,
): boolean {
  const flag = environ.DOWNLOAD_DRY_RUN?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  if (environ.VERCEL_ENV === "production") return false;
  return !environ.STRIPE_SECRET_KEY?.trim();
}

export function allowFixtureMaster(
  environ: Record<string, string | undefined> = process.env,
): boolean {
  const flag = environ.DOWNLOAD_ALLOW_FIXTURE?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  if (environ.VERCEL_ENV === "production") return false;
  return allowDryRunDownloads(environ) || !environ.BLOB_READ_WRITE_TOKEN?.trim();
}

export function serverPriceGbp(
  environ: Record<string, string | undefined> = process.env,
): number {
  return parsePriceGbp(
    environ.TRACK_DOWNLOAD_PRICE_GBP ?? environ.VITE_TRACK_DOWNLOAD_PRICE_GBP,
    DEFAULT_DOWNLOAD_PRICE_GBP,
  );
}

export type CheckoutStart =
  | { ok: true; url: string; dryRun: boolean }
  | { ok: false; message: string };

export type DownloadGrantView = {
  ok: true;
  trackId: string;
  slug: string;
  title: string;
  image: string;
  filename: string;
  downloadUrl: string;
  expiresAt: string;
  usesRemaining: number;
  dryRun: boolean;
  email?: string;
};

export type DownloadGrantResult =
  | DownloadGrantView
  | { ok: false; message: string };

export type Storefront = {
  priceGbp: number;
  currency: "gbp";
  stripeReady: boolean;
  dryRun: boolean;
};
