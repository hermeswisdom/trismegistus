/**
 * Server-only: short-lived presigned GET URLs for stream files.
 *
 * The browser's <audio> loads /api/stream/<slug> (Auto Mix adds ?hq=1), which
 * redirects here so the file itself comes straight from the Blob CDN (byte
 * ranges, cache, Blob data transfer rates) rather than through a Function.
 * Each URL is signed for one pathname under streams/ or streams-hq/ only; the
 * paid masters are never signed. HQ objects are uploaded separately, so a
 * missing streams-hq/<slug>.mp3 falls back to the 128k streams/<slug>.mp3.
 */
import { env } from "./env.server.ts";
import { pickStreamBlobPath, streamBlobPath } from "./streams.ts";

/** Presigned URL lifetime. Long enough for a paused tab to resume/seek. */
export const STREAM_URL_TTL_MS = 6 * 60 * 60 * 1000;
/** Reuse a signing delegation while it has at least this long left. */
const REUSE_MIN_MS = 2 * 60 * 60 * 1000;
/** How long a HQ-exists probe is reused. Misses stay short so new uploads land. */
export const HQ_PROBE_TTL_MS = 2 * 60 * 1000;

type Delegation = { delegationToken: string; clientSigningToken: string; validUntil: number };
const delegations = new Map<string, Delegation>();

type HqProbe = (pathname: string) => Promise<boolean> | boolean;
const hqProbeCache = new Map<string, { exists: boolean; at: number }>();
const hqInflight = new Map<string, Promise<boolean>>();
let hqProbe: HqProbe = defaultHqProbe;

function blobAuth(): { token?: string } | null {
  const token = env("BLOB_READ_WRITE_TOKEN");
  if (token) return { token };
  if (env("BLOB_STORE_ID")) return {};
  return null;
}

async function defaultHqProbe(pathname: string): Promise<boolean> {
  const auth = blobAuth();
  if (!auth) return false;
  try {
    const { head } = await import("@vercel/blob");
    await head(pathname, auth);
    return true;
  } catch {
    return false;
  }
}

export function setHqBlobProbeForTests(fn: HqProbe | null) {
  hqProbe = fn ?? defaultHqProbe;
  hqProbeCache.clear();
  hqInflight.clear();
}

export function resetStreamStoreForTests() {
  setHqBlobProbeForTests(null);
  delegations.clear();
}

/**
 * Whether `streams-hq/<slug>.mp3` is on Blob. Failures (missing file, no
 * token, network) are "not yet" so Auto Mix still gets the 128k fallback.
 */
export async function hqStreamAvailable(pathname: string, now = Date.now()): Promise<boolean> {
  const hit = hqProbeCache.get(pathname);
  if (hit && now - hit.at < HQ_PROBE_TTL_MS) return hit.exists;
  const pending = hqInflight.get(pathname);
  if (pending) return pending;
  const p = Promise.resolve()
    .then(() => hqProbe(pathname))
    .then((exists) => {
      const ok = Boolean(exists);
      hqProbeCache.set(pathname, { exists: ok, at: now });
      return ok;
    })
    .catch(() => false)
    .finally(() => {
      if (hqInflight.get(pathname) === p) hqInflight.delete(pathname);
    });
  hqInflight.set(pathname, p);
  return p;
}

/** Blob pathname this request should sign: HQ when present, else 128k. */
export async function streamSignPathname(
  slug: string,
  opts: { hq?: boolean; now?: number } = {},
): Promise<string | null> {
  const hqPath = opts.hq ? streamBlobPath(slug, { hq: true }) : null;
  const hqAvailable = hqPath ? await hqStreamAvailable(hqPath, opts.now) : false;
  return pickStreamBlobPath({ slug, preferHq: opts.hq, hqAvailable });
}

export async function presignedStreamUrl(
  slug: string,
  opts: { now?: number; hq?: boolean } = {},
): Promise<string | null> {
  const now = opts.now ?? Date.now();
  const pathname = await streamSignPathname(slug, { hq: opts.hq, now });
  if (!pathname) return null;
  const auth = blobAuth();
  if (!auth) return null;
  const { issueSignedToken, presignUrl } = await import("@vercel/blob");
  let delegation = delegations.get(pathname);
  if (!delegation || delegation.validUntil - now < REUSE_MIN_MS) {
    delegation = await issueSignedToken({
      ...auth,
      pathname,
      operations: ["get"],
      validUntil: now + STREAM_URL_TTL_MS,
    });
    delegations.set(pathname, delegation);
  }
  const { presignedUrl } = await presignUrl(delegation, {
    operation: "get",
    pathname,
    access: "private",
  });
  return presignedUrl;
}
