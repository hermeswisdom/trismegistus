import { createFileRoute } from "@tanstack/react-router";
import { presignedStreamUrl } from "@/lib/stream-store";
import { blobHostFromToken, sameOriginStreamPath } from "@/lib/stream-proxy";
import { hasStream, wantsHqStream } from "@/lib/streams";

/**
 * GET /api/stream/<slug> → 302 to a short-lived presigned URL for the stream
 * file. Default is the 128 kbps copy (streams/<slug>.mp3). `?hq=1` prefers the
 * 320 kbps copy (streams-hq/<slug>.mp3) and falls back to 128k when that
 * object is missing. Never serves masters/. Does not count plays.
 *
 * On Vercel the redirect stays on our own origin (/media/streams/<slug>.mp3?sig
 * or /media/streams-hq/<slug>.mp3?sig, rewritten to Blob by the CDN; see
 * vite.config.ts) so iOS / Web Audio play a same-origin media resource.
 * `?via=direct` keeps the old cross-origin redirect for A/B.
 */
declare const __STREAM_PROXY_HOST__: string;

function proxyHost(): string | null {
  // Set at build time only when the CDN rewrite was emitted (vite.config.ts).
  const built = typeof __STREAM_PROXY_HOST__ === "string" ? __STREAM_PROXY_HOST__ : "";
  if (!built || !process.env.VERCEL) return null;
  return built === blobHostFromToken(process.env.BLOB_READ_WRITE_TOKEN) ? built : null;
}

async function handle(slug: string | undefined, request?: Request) {
  if (!slug || !hasStream(slug)) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const search = request ? new URL(request.url).searchParams : new URLSearchParams();
  const hq = wantsHqStream(search);
  let url: string | null = null;
  try {
    url = await presignedStreamUrl(slug, { hq });
  } catch {
    url = null;
  }
  if (!url) {
    return new Response("Stream unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const direct = search.get("via") === "direct";
  const location = (!direct && sameOriginStreamPath(url, proxyHost())) || url;
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      // The signed URL lasts hours; let the browser reuse this redirect briefly.
      "Cache-Control": "private, max-age=600",
      "X-Robots-Tag": "noindex",
    },
  });
}

export const Route = createFileRoute("/api/stream/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => handle(params.slug, request),
      HEAD: async ({ params, request }) => handle(params.slug, request),
    },
  },
});
