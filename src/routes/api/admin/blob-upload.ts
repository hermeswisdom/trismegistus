import { createFileRoute } from "@tanstack/react-router";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { env } from "@/lib/env.server";
import {
  COVER_CONTENT_TYPES,
  MAX_COVER_BYTES,
  MAX_MP3_BYTES,
  MP3_CONTENT_TYPES,
  validateQueueBlobPathname,
} from "@/lib/upload-queue";

/**
 * POST /api/admin/blob-upload — client-token endpoint for direct
 * browser -> Blob uploads (bypasses the Vercel Function body limit; MP3s are
 * ~5 MB, cap 25 MB). Only an admin-allowlisted session gets a token, the
 * token is pinned to one queue/<uuid> pathname, private access, a content-type
 * allowlist and a size cap. Non-admins get 404, like the rest of /admin.
 * No DB row is written here — the client calls createAdminQueueItem after
 * the upload completes, and that re-validates every pathname.
 */
export const Route = createFileRoute("/api/admin/blob-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getAdminUser } = await import("@/lib/upload-queue.server");
        const admin = await getAdminUser(request.headers);
        if (!admin) return new Response("Not found", { status: 404 });
        if (!env("BLOB_READ_WRITE_TOKEN") && !env("BLOB_STORE_ID")) {
          return Response.json(
            { error: "Blob is not configured (BLOB_READ_WRITE_TOKEN missing)." },
            { status: 503 },
          );
        }
        const body = (await request.json()) as HandleUploadBody;
        const jsonResponse = await handleUpload({
          body,
          request,
          token: env("BLOB_READ_WRITE_TOKEN"),
          onBeforeGenerateToken: async (pathname) => {
            const check = validateQueueBlobPathname(pathname);
            if (!check.ok) throw new Error(check.error);
            return {
              allowedContentTypes:
                check.kind === "mp3" ? [...MP3_CONTENT_TYPES] : [...COVER_CONTENT_TYPES],
              maximumSizeInBytes: check.kind === "mp3" ? MAX_MP3_BYTES : MAX_COVER_BYTES,
              addRandomSuffix: false,
              allowOverwrite: false,
              tokenPayload: JSON.stringify({ uploadedBy: admin.email, kind: check.kind }),
            };
          },
        });
        return Response.json(jsonResponse);
      },
    },
  },
});
