import { createServerFn } from "@tanstack/react-start";
import { isQueueStatus } from "@/lib/upload-queue";

/**
 * Admin-only server functions for /admin. Every handler re-checks the admin
 * allowlist server-side (requireAdmin throws a 404-shaped error), so a forged
 * client call from a non-admin session gets nothing — no list, no write.
 * Session resolution rides the request cookie via auth.api.getSession inside
 * upload-queue.server (same pattern as /api/auth/*), so no middleware
 * user-id threading is needed here.
 */
async function adminDeps() {
  return import("@/lib/upload-queue.server");
}

export const getAdminQueue = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, listQueueItems } = await adminDeps();
  await requireAdmin();
  return { items: await listQueueItems("waiting") };
});

export const createAdminQueueItem = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as Record<string, unknown>)
  .handler(async ({ data }) => {
    const { requireAdmin, createQueueItem } = await adminDeps();
    const admin = await requireAdmin();
    const item = await createQueueItem(data as never, admin);
    return { item };
  });

export const deleteAdminQueueItem = createServerFn({ method: "POST" })
  .validator((input: { id?: unknown }) => ({ id: input?.id }))
  .handler(async ({ data }) => {
    const { requireAdmin, deleteWaitingQueueItem } = await adminDeps();
    await requireAdmin();
    return deleteWaitingQueueItem(data.id);
  });

/** Status-filtered list for future phases; Phase 1 UI only asks for waiting. */
export const listAdminQueueByStatus = createServerFn({ method: "GET" })
  .validator((input: { status?: unknown } | undefined) => ({
    status: isQueueStatus(input?.status) ? input.status : "waiting",
  }))
  .handler(async ({ data }) => {
    const { requireAdmin, listQueueItems } = await adminDeps();
    await requireAdmin();
    return { items: await listQueueItems(data.status) };
  });
