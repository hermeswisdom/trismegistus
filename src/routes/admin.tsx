import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getAdminAccess, getAdminQueue } from "@/lib/admin-queue";
import { AdminUploadQueue } from "@/components/admin-upload-queue";
import { NOINDEX_META } from "@/lib/seo";

/**
 * /admin — Phase 1 upload queue. Server-side gated in the loader: the
 * getAdminQueue server function re-verifies the session + ADMIN_EMAILS
 * allowlist on the server, and a signed-in non-admin (wrong account, auth
 * off) gets a 404 here — the page, its data and its existence are not
 * revealed. There is no client-side gate to bypass.
 *
 * A visitor with no session at all is the one exception: they are sent to
 * the site's sign-in (/login?next=/admin) and back, instead of a bare 404
 * they cannot act on. That reveals nothing a signed-in probe could not —
 * /login is already the site's public account door.
 */
export const Route = createFileRoute("/admin")({
  loader: async () => {
    let kind: string;
    try {
      ({ kind } = await getAdminAccess());
    } catch {
      throw notFound();
    }
    if (kind === "signed_out") {
      throw redirect({ to: "/login", search: { next: "/admin" } });
    }
    if (kind !== "admin") throw notFound();
    try {
      return await getAdminQueue();
    } catch {
      throw notFound();
    }
  },
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin — Atman Music" }, NOINDEX_META] }),
});

function AdminPage() {
  const { items } = Route.useLoaderData();
  return (
    <main className="min-h-dvh bg-bg px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-medium tracking-[0.32em] text-accent uppercase">Admin</p>
        <h1 className="mt-3 font-display text-section text-fg">Upload queue</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Drop a track here and it waits — private, off the wall — until it is
          picked up and published by hand.
        </p>
        <AdminUploadQueue initialItems={items} />
      </div>
    </main>
  );
}
