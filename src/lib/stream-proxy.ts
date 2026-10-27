/**
 * Same-origin streams. The browser plays /media/streams/<slug>.mp3?<signature>
 * (or /media/streams-hq/<slug>.mp3 for Auto Mix) from our own domain; Vercel's
 * CDN rewrites that path to the matching private Blob prefix (a Nitro `proxy`
 * route rule → CDN rewrite, no Function in the byte path), passing the signed
 * query and Range headers through. The signature is still the one issued for
 * that single streams/ or streams-hq/ object, so masters/ stays unreachable.
 */

/** Public path prefix the CDN rewrites to the store's streams/ prefix. */
export const SAME_ORIGIN_STREAM_PREFIX = "/media/streams/";
/** Public path prefix the CDN rewrites to the store's streams-hq/ prefix. */
export const SAME_ORIGIN_STREAM_HQ_PREFIX = "/media/streams-hq/";

const STREAM_OBJECT = /^\/(streams-hq|streams)\/([a-z0-9][a-z0-9-]*\.mp3)$/;

/**
 * Blob store host from a read-write token (`vercel_blob_rw_<storeId>_<secret>`):
 * `<storeid>.private.blob.vercel-storage.com`. Never returns any part of the secret.
 */
export function blobHostFromToken(token: string | null | undefined): string | null {
  const m = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(String(token ?? "").trim());
  return m ? `${m[1].toLowerCase()}.private.blob.vercel-storage.com` : null;
}

/** Same-origin path for a presigned stream URL on `host`, or null if it is not one. */
export function sameOriginStreamPath(presignedUrl: string, host: string | null | undefined): string | null {
  if (!host) return null;
  let u: URL;
  try {
    u = new URL(presignedUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.host !== host) return null;
  const m = STREAM_OBJECT.exec(u.pathname);
  if (!m) return null;
  const prefix = m[1] === "streams-hq" ? SAME_ORIGIN_STREAM_HQ_PREFIX : SAME_ORIGIN_STREAM_PREFIX;
  return `${prefix}${m[2]}${u.search}`;
}

/** Page query `?stream=direct` keeps the old cross-origin redirect (A/B on a phone). */
export function streamVia(search: string | null | undefined): "direct" | "same-origin" {
  try {
    return new URLSearchParams(search ?? "").get("stream") === "direct" ? "direct" : "same-origin";
  } catch {
    return "same-origin";
  }
}
