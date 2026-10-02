import { createFileRoute } from "@tanstack/react-router";
import { parseEbookFormat } from "@/lib/ebook";
import { shouldCountRequest } from "@/lib/qc-traffic";

/**
 * POST /api/ebook/hit?format=pdf|epub — fire-and-forget download counter
 * (navigator.sendBeacon from the Download buttons). Always 204. Writes only on
 * the production deployment, never for QC traffic (?qc=1 referer, x-qc-test,
 * test-browser UAs), and only for same-origin posts.
 */
const NO_CONTENT = () =>
  new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host ||
      new URL(origin).host === request.headers.get("x-forwarded-host");
  } catch {
    return false;
  }
}

async function hit(request: Request): Promise<Response> {
  const format = parseEbookFormat(new URL(request.url).searchParams.get("format"));
  if (!format || !sameOrigin(request)) return NO_CONTENT();
  if (!shouldCountRequest(request, process.env.VERCEL_ENV)) return NO_CONTENT();
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into ebook_downloads (format, downloads, last_download_at)
      values (${format}, 1, now())
      on conflict (format) do update
        set downloads = ebook_downloads.downloads + 1,
            last_download_at = now()
    `;
  } catch {
    /* counting never blocks a download */
  }
  return NO_CONTENT();
}

export const Route = createFileRoute("/api/ebook/hit")({
  server: {
    handlers: {
      POST: async ({ request }) => hit(request),
    },
  },
});
