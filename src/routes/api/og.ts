import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/og → 1200×630 PNG.
 *   (none)        branded default card
 *   ?slug=<slug>  track cover + title + mood accent
 *   ?mix=<id>     reserved for Auto Mix cards (currently the default card)
 *
 * Dynamic-import the renderer so other routes do not load @vercel/og.
 */
export const Route = createFileRoute("/api/og")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { renderOgImage } = await import("@/lib/og-image");
        return renderOgImage(request);
      },
      HEAD: async ({ request }) => {
        const { renderOgImage } = await import("@/lib/og-image");
        return renderOgImage(request);
      },
    },
  },
});
