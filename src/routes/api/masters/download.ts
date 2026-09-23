import { createFileRoute } from "@tanstack/react-router";
import { verifyDownloadToken } from "@/lib/download-token";
import { loadMaster, masterResponseHeaders } from "@/lib/master-store";
import {
  consumeDownload,
  downloadTokenSecret,
  findPurchaseBySession,
  masterDryRunEnabled,
} from "@/lib/purchases";
import { canRedeemPurchase } from "@/lib/download-token";

export const Route = createFileRoute("/api/masters/download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token")?.trim();
        if (!token) {
          return Response.json({ error: "Missing download token." }, { status: 400 });
        }
        const secret = downloadTokenSecret();
        if (!secret) {
          return Response.json({ error: "DOWNLOAD_TOKEN_SECRET is not set." }, { status: 503 });
        }
        let grant;
        try {
          grant = await verifyDownloadToken(token, secret);
        } catch {
          return Response.json({ error: "This download link is invalid or expired." }, { status: 403 });
        }

        let consumed = null;
        try {
          consumed = await consumeDownload(grant.sid);
        } catch {
          consumed = null;
        }

        if (!consumed) {
          const row = await findPurchaseBySession(grant.sid);
          if (row) {
            const expiresAtMs = Date.parse(row.expiresAt);
            const allowed = canRedeemPurchase({
              expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : 0,
              downloadCount: row.downloadCount,
              maxDownloads: row.maxDownloads,
            });
            if (!allowed.ok) {
              return Response.json({ error: allowed.reason }, { status: 403 });
            }
            if (row.downloadKey !== grant.key || row.receiptToken !== grant.rec) {
              return Response.json({ error: "This token does not match the receipt." }, { status: 403 });
            }
          } else if (!masterDryRunEnabled()) {
            return Response.json({ error: "Receipt not found. Pay again or wait for the webhook." }, { status: 404 });
          }
        } else if (consumed.downloadKey !== grant.key) {
          return Response.json({ error: "This token does not match the receipt." }, { status: 403 });
        }

        const master = await loadMaster(grant.key);
        if (!master) {
          return Response.json(
            {
              error:
                "The master file is not in Blob yet. Upload masters/<slug>.mp3 (see README). Dry-run uses the silent fixture when MASTER_DRY_RUN=1.",
            },
            { status: 404 },
          );
        }
        return new Response(master.body, {
          status: 200,
          headers: masterResponseHeaders(master),
        });
      },
    },
  },
});
