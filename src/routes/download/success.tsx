import { useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { HermesNote } from "@/components/hermes-note";
import { DOWNLOAD_LEGAL, loadDownloadGrant } from "@/lib/downloads";

function parseSuccessSearch(search: Record<string, unknown>): {
  session_id?: string;
  t?: string;
} {
  return {
    session_id:
      typeof search.session_id === "string" ? search.session_id : undefined,
    t: typeof search.t === "string" ? search.t : undefined,
  };
}

export const Route = createFileRoute("/download/success")({
  validateSearch: parseSuccessSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) =>
    loadDownloadGrant({
      data: { sessionId: deps.session_id, token: deps.t },
    }),
  component: DownloadSuccessPage,
  head: () => ({
    meta: [{ title: "Your master — Atman Music" }],
  }),
});

function DownloadSuccessPage() {
  const grant = Route.useLoaderData();
  const started = useRef(false);

  useEffect(() => {
    if (!grant.ok || started.current) return;
    started.current = true;
    const link = document.createElement("a");
    link.href = grant.downloadUrl;
    link.setAttribute("download", grant.filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [grant]);

  return (
    <main className="min-h-dvh bg-bg px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8">
      <div className="grain" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col justify-center py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-display text-sm tracking-[0.16em] text-fg uppercase"
        >
          <HermesNote size="mark" />
          Atman Music
        </Link>
        <p className="mt-12 text-xs font-medium tracking-[0.32em] text-accent uppercase">
          The master
        </p>
        {grant.ok ? (
          <>
            <h1 className="mt-3 max-w-xl font-display text-section text-fg">
              {grant.title}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base">
              {DOWNLOAD_LEGAL}. The file should start now. Keep this page — it
              re-downloads for about 48 hours, a few times.
            </p>
            {grant.dryRun ? (
              <p className="mt-3 max-w-md text-sm text-accent">
                Dry-run · no charge. Add Stripe test keys to take a real
                payment. This file is a silent fixture until the Blob master is
                uploaded.
              </p>
            ) : null}
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <a
                href={grant.downloadUrl}
                download={grant.filename}
                className="inline-flex h-12 w-fit items-center gap-2 bg-accent px-7 text-xs font-medium tracking-[0.2em] text-bg uppercase transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.96]"
              >
                <Download className="size-3.5" />
                Download MP3
              </a>
              <Link
                to="/"
                search={{ tablet: grant.slug }}
                className="inline-flex h-12 w-fit items-center gap-2 bg-elevated px-5 text-xs font-medium tracking-[0.2em] text-fg uppercase transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.96]"
              >
                Back to the wall
              </Link>
            </div>
            <p className="mt-6 text-xs tracking-[0.16em] text-subtle uppercase">
              {grant.usesRemaining} uses left · {DOWNLOAD_LEGAL}
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-3 max-w-xl font-display text-section text-fg">
              No file yet.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base">
              {grant.message} If you paid, wait a moment and refresh — or open
              the link from your Stripe receipt.
            </p>
            <Link
              to="/"
              className="mt-10 inline-flex h-12 w-fit items-center gap-2 bg-accent px-7 text-xs font-medium tracking-[0.2em] text-bg uppercase"
            >
              Back to the wall
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
