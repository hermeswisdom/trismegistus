import { createFileRoute } from "@tanstack/react-router";
import { presignedStreamUrl } from "@/lib/stream-store";
import { blobHostFromToken, sameOriginStreamPath } from "@/lib/stream-proxy";
import { hasStream } from "@/lib/streams";

/**
 * GET /api/stream/<slug> → 302 to a short-lived presigned URL for the 128 kbps
 * stream (streams/<slug>.mp3). Never serves masters/. Does not count plays.
 *
 * On Vercel the redirect stays on our own origin (/media/streams/<slug>.mp3?sig,
 * rewritten to Blob by the CDN; see vite.config.ts) so iOS plays a same-origin
 * media resource. `?via=direct` keeps the old cross-origin redirect for A/B.
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
  let url: string | null = null;
  try {
    url = await presignedStreamUrl(slug);
  } catch {
    url = null;
  }
  if (!url) {
    return new Response("Stream unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const direct = request ? new URL(request.url).searchParams.get("via") === "direct" : false;
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
