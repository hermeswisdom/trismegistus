import { createFileRoute } from "@tanstack/react-router";
import { renderOgImage } from "@/lib/og-image";

/**
 * GET /api/og → 1200×630 PNG.
 *   (none)        branded default card
 *   ?slug=<slug>  track cover + title + mood accent
 *   ?mix=<id>     reserved for Auto Mix cards (currently the default card)
 */
export const Route = createFileRoute("/api/og")({
  server: {
    handlers: {
      GET: async ({ request }) => renderOgImage(request),
      HEAD: async ({ request }) => renderOgImage(request),
    },
  },
});
