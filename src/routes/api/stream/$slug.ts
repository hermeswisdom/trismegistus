import { createFileRoute } from "@tanstack/react-router";
import { presignedStreamUrl } from "@/lib/stream-store";
import { hasStream } from "@/lib/streams";

/**
 * GET /api/stream/<slug> → 302 to a short-lived presigned URL for the 128 kbps
 * stream (streams/<slug>.mp3). Never serves masters/. Does not count plays.
 */
async function handle(slug: string | undefined) {
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
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      // The signed URL lasts hours; let the browser reuse this redirect briefly.
      "Cache-Control": "private, max-age=600",
      "X-Robots-Tag": "noindex",
    },
  });
}

export const Route = createFileRoute("/api/stream/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => handle(params.slug),
      HEAD: async ({ params }) => handle(params.slug),
    },
  },
});
