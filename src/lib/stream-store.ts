/**
 * Server-only: short-lived presigned GET URLs for the 128 kbps streams.
 *
 * The browser's <audio> loads /api/stream/<slug>, which redirects here so the
 * file itself comes straight from the Blob CDN (byte ranges, cache, Blob data
 * transfer rates) rather than through a Function. Each URL is signed for one
 * pathname under streams/ only; the paid masters are never signed.
 */
import { env } from "@/lib/env.server";
import { streamBlobPath } from "@/lib/streams";

/** Presigned URL lifetime. Long enough for a paused tab to resume/seek. */
export const STREAM_URL_TTL_MS = 6 * 60 * 60 * 1000;
/** Reuse a signing delegation while it has at least this long left. */
const REUSE_MIN_MS = 2 * 60 * 60 * 1000;

type Delegation = { delegationToken: string; clientSigningToken: string; validUntil: number };
const delegations = new Map<string, Delegation>();

function blobAuth(): { token?: string } | null {
  const token = env("BLOB_READ_WRITE_TOKEN");
  if (token) return { token };
  if (env("BLOB_STORE_ID")) return {};
  return null;
}

export async function presignedStreamUrl(slug: string, now = Date.now()): Promise<string | null> {
  const pathname = streamBlobPath(slug);
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
