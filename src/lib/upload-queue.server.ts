/**
 * Server-only queue store + admin gate. Never import from client code.
 *
 * Admin identity: there is no role column on Better Auth's `user` table, so
 * admin = a verified session whose email is on the ADMIN_EMAILS allowlist
 * (src/lib/upload-queue.ts; defaults to Atman's smlc@me.com when unset).
 * Fail closed: no session, auth off, or a non-allowlisted email is not admin.
 * The dev fallback user (auth disabled, no DB) is never admin.
 */
import { auth } from "@/lib/auth/server";
import { env } from "@/lib/env.server";
import {
  adminAccessKind,
  buildQueueRecord,
  isQueueId,
  type AdminAccessKind,
  type QueueItemInput,
  type QueueRecord,
} from "@/lib/upload-queue";
import {
  DELETE_WAITING_QUEUE_SQL,
  GET_QUEUE_ITEM_SQL,
  INSERT_QUEUE_SQL,
  LIST_QUEUE_SQL,
} from "@/lib/upload-queue-sql";

export type AdminUser = { id: string; email: string };

export type AdminAccess =
  | { kind: "admin"; user: AdminUser }
  | { kind: Exclude<AdminAccessKind, "admin"> };

/**
 * Resolve the /admin gate without conflating its outcomes: no/invalid
 * session is `signed_out` (the route may send that visitor to sign in),
 * while a real session whose email is not allowlisted is `not_admin`
 * (the route must keep the bare 404). Any resolution failure fails
 * closed as `signed_out` — no admin data is ever returned on this path,
 * and requireAdmin()/getAdminUser() below re-verify before any data.
 */
export async function resolveAdminAccess(headers?: Headers): Promise<AdminAccess> {
  try {
    let h = headers;
    if (!h) {
      const { getRequest } = await import("@tanstack/react-start/server");
      h = getRequest()?.headers;
    }
    if (!h) return { kind: "signed_out" };
    const session = await auth.api.getSession({ headers: h });
    const email = session?.user?.email ?? null;
    const kind = adminAccessKind(Boolean(session?.user), email, env("ADMIN_EMAILS"));
    if (kind === "signed_out") return { kind };
    if (kind === "not_admin" || !session?.user) return { kind: "not_admin" };
    return { kind, user: { id: session.user.id, email: email as string } };
  } catch {
    return { kind: "signed_out" };
  }
}

export async function getAdminUser(headers?: Headers): Promise<AdminUser | null> {
  const access = await resolveAdminAccess(headers);
  return access.kind === "admin" ? access.user : null;
}

export class AdminNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super("Not found");
    this.name = "AdminNotFoundError";
  }
}

export async function requireAdmin(headers?: Headers): Promise<AdminUser> {
  const admin = await getAdminUser(headers);
  if (!admin) throw new AdminNotFoundError();
  return admin;
}

export type QueueItemRow = QueueRecord & { createdAt: string; coverThumbUrl: string | null };

async function sqlClient() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

/** Short-lived signed URL so the private cover can render as an admin thumb. */
async function coverThumbUrl(pathname: string | null): Promise<string | null> {
  if (!pathname) return null;
  try {
    const token = env("BLOB_READ_WRITE_TOKEN");
    if (!token && !env("BLOB_STORE_ID")) return null;
    const { issueSignedToken, presignUrl } = await import("@vercel/blob");
    const delegation = await issueSignedToken({
      ...(token ? { token } : {}),
      pathname,
      operations: ["get"],
      validUntil: Date.now() + 60 * 60 * 1000,
    });
    const { presignedUrl } = await presignUrl(delegation, {
      operation: "get",
      pathname,
      access: "private",
    });
    return presignedUrl;
  } catch {
    return null;
  }
}

export async function listQueueItems(status = "waiting"): Promise<QueueItemRow[]> {
  const sql = await sqlClient();
  const rows = await sql.query<QueueRecord & { createdAt: string }>(LIST_QUEUE_SQL, [status]);
  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(r.createdAt as never).toISOString(),
      mp3SizeBytes: r.mp3SizeBytes == null ? null : Number(r.mp3SizeBytes),
      coverSizeBytes: r.coverSizeBytes == null ? null : Number(r.coverSizeBytes),
      durationSeconds: r.durationSeconds == null ? null : Number(r.durationSeconds),
      coverThumbUrl: await coverThumbUrl(r.coverBlobPathname),
    })),
  );
}

export async function createQueueItem(input: QueueItemInput, admin: AdminUser): Promise<QueueItemRow> {
  const record = buildQueueRecord(input, admin.email);
  const sql = await sqlClient();
  const rows = await sql.query<QueueRecord & { createdAt: string }>(INSERT_QUEUE_SQL, [
    record.id, record.title, record.originalFilename,
    record.mp3BlobPathname, record.mp3BlobUrl, record.mp3SizeBytes,
    record.coverBlobPathname, record.coverBlobUrl, record.coverSizeBytes,
    record.durationSeconds, record.notes, record.status, record.uploadedBy,
  ]);
  const row = rows[0];
  return {
    ...record,
    createdAt: typeof row?.createdAt === "string" ? row.createdAt : new Date().toISOString(),
    coverThumbUrl: await coverThumbUrl(record.coverBlobPathname),
  };
}

/** Delete a waiting item's record, then best-effort delete its Blob files. */
export async function deleteWaitingQueueItem(
  id: unknown,
): Promise<{ deleted: boolean; blobErrors: string[] }> {
  if (!isQueueId(id)) throw new Error("Invalid queue id.");
  const sql = await sqlClient();
  const existing = await sql.query<{ mp3BlobPathname: string; coverBlobPathname: string | null }>(
    GET_QUEUE_ITEM_SQL,
    [id],
  );
  if (!existing[0]) return { deleted: false, blobErrors: [] };
  const removed = await sql.query<{ mp3BlobPathname: string; coverBlobPathname: string | null }>(
    DELETE_WAITING_QUEUE_SQL,
    [id],
  );
  if (!removed[0]) return { deleted: false, blobErrors: [] }; // not waiting anymore
  const blobErrors: string[] = [];
  const paths = [removed[0].mp3BlobPathname, removed[0].coverBlobPathname].filter(
    (p): p is string => Boolean(p),
  );
  if (paths.length && (env("BLOB_READ_WRITE_TOKEN") || env("BLOB_STORE_ID"))) {
    try {
      const { del } = await import("@vercel/blob");
      await del(paths, env("BLOB_READ_WRITE_TOKEN") ? { token: env("BLOB_READ_WRITE_TOKEN") } : {});
    } catch (err) {
      blobErrors.push(err instanceof Error ? err.message : "Blob delete failed");
    }
  }
  return { deleted: true, blobErrors };
}
