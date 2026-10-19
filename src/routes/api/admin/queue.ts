import { createFileRoute } from "@tanstack/react-router";
import { isQueueStatus } from "@/lib/upload-queue";

/**
 * GET /api/admin/queue?status=waiting — admin-only pickup list for agents.
 * Non-admin / signed-out callers get 404 (no public listing endpoint exists).
 * Prefer scripts/list-queue.mjs for offline pickup; this is the same data
 * over HTTP. Never linked or rendered on any public page.
 */
export const Route = createFileRoute("/api/admin/queue")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getAdminUser, listQueueItems } = await import("@/lib/upload-queue.server");
        const admin = await getAdminUser(request.headers);
        if (!admin) return Response.json({ error: "not found" }, { status: 404 });
        const statusParam = new URL(request.url).searchParams.get("status") ?? "waiting";
        if (!isQueueStatus(statusParam))
          return Response.json({ error: "invalid status" }, { status: 400 });
        const items = await listQueueItems(statusParam);
        return Response.json(
          { items },
          { headers: { "Cache-Control": "private, no-store" } },
        );
      },
    },
  },
});
