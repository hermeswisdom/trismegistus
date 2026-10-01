import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { HermesNote } from "@/components/hermes-note";
import { parseDownloadSearch } from "@/lib/download-search";
import { MASTER_LICENSE_LINE } from "@/lib/masters";
import { redeemMasterPurchase } from "@/lib/master-checkout";
import { getTrackBySlug } from "@/lib/rooms";

export const Route = createFileRoute("/download")({
  validateSearch: parseDownloadSearch,
  loaderDeps: ({ search }) => ({
    session_id: search.session_id,
    receipt: search.receipt,
    cancelled: search.cancelled,
    tablet: search.tablet,
  }),
  loader: async ({ deps }) => {
    if (deps.cancelled) {
      return { kind: "cancelled" as const, tablet: deps.tablet };
    }
    if (!deps.session_id && !deps.receipt) {
      return { kind: "idle" as const };
    }
    const result = await redeemMasterPurchase({
      data: { sessionId: deps.session_id, receipt: deps.receipt },
    });
    return { kind: "redeem" as const, result };
  },
  component: DownloadPage,
  head: () => ({
    meta: [{ title: "Master MP3 — Atman Music" }],
  }),
});

function DownloadPage() {
  const data = Route.useLoaderData();
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (data.kind !== "redeem" || !data.result.ok || started) return;
    setStarted(true);
    const link = document.createElement("a");
    link.href = data.result.downloadUrl;
    link.rel = "noopener";
    link.click();
  }, [data, started]);

  const cancelledTrack =
    data.kind === "cancelled" && data.tablet
      ? getTrackBySlug(data.tablet)
      : undefined;

  return (
    <main className="min-h-dvh bg-bg px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col justify-center py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-display text-sm tracking-[0.16em] text-fg uppercase"
        >
          <HermesNote size="mark" />
          Atman Music
        </Link>
        {data.kind === "cancelled" ? (
          <>
            <p className="mt-12 text-xs font-medium tracking-[0.32em] text-accent uppercase">
              Checkout cancelled
            </p>
            <h1 className="mt-3 max-w-xl font-display text-section text-fg">
              The master stayed in the vault.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base">
              Listening on SoundCloud stays free. Pay only if you want the raw
              master MP3 for personal use.
            </p>
            <div className="mt-10 flex flex-wrap gap-2">
              <Link
                to="/"
                search={cancelledTrack ? { tablet: cancelledTrack.slug } : {}}
                className="inline-flex h-12 items-center bg-accent px-7 text-xs font-medium tracking-[0.2em] text-bg uppercase"
              >
                Back to the wall
              </Link>
            </div>
          </>
        ) : data.kind === "redeem" && data.result.ok ? (
          <>
            <p className="mt-12 text-xs font-medium tracking-[0.32em] text-accent uppercase">
              Paid
            </p>
            <h1 className="mt-3 max-w-xl font-display text-section text-fg">
              {data.result.title}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base">
              {data.result.license}. The download should start now. Keep this
              receipt — it works for about 48 hours, {data.result.downloadsLeft}{" "}
              uses left.
            </p>
            {data.result.dryRun ? (
              <p className="mt-3 max-w-md text-sm text-accent">
                Dry-run. No Stripe charge. Production serves the Blob master.
              </p>
            ) : null}
            <div className="mt-10 flex flex-wrap gap-2">
              <a
                href={data.result.downloadUrl}
                className="inline-flex h-12 items-center bg-accent px-7 text-xs font-medium tracking-[0.2em] text-bg uppercase"
              >
                Download again
              </a>
              <Link
                to="/"
                search={{ tablet: data.result.trackId }}
                className="inline-flex h-12 items-center bg-elevated px-7 text-xs font-medium tracking-[0.2em] text-fg uppercase"
              >
                Back to the wall
              </Link>
            </div>
            <p className="mt-8 max-w-lg text-[0.7rem] leading-relaxed tracking-[0.08em] text-subtle uppercase">
              Receipt token · {data.result.receipt}
            </p>
            <p className="mt-2 max-w-lg break-all text-[0.7rem] text-subtle">
              {data.result.receiptUrl}
            </p>
          </>
        ) : data.kind === "redeem" && !data.result.ok ? (
          <>
            <p className="mt-12 text-xs font-medium tracking-[0.32em] text-accent uppercase">
              Receipt
            </p>
            <h1 className="mt-3 max-w-xl font-display text-section text-fg">
              This download is closed.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base">
              {data.result.error}
            </p>
            <div className="mt-10">
              <Link
                to="/"
                className="inline-flex h-12 items-center bg-accent px-7 text-xs font-medium tracking-[0.2em] text-bg uppercase"
              >
                Back to the wall
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="mt-12 text-xs font-medium tracking-[0.32em] text-accent uppercase">
              Master MP3
            </p>
            <h1 className="mt-3 max-w-xl font-display text-section text-fg">
              Redeem a receipt.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base">
              After Stripe Checkout, this page starts the download. Come back
              with the receipt link for about 48 hours. {MASTER_LICENSE_LINE}.
            </p>
            <RedeemForm />
            <div className="mt-8">
              <Link
                to="/"
                className="text-xs tracking-[0.16em] text-subtle uppercase hover:text-accent"
              >
                Back to the wall
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function RedeemForm() {
  const [receipt, setReceipt] = useState("");
  return (
    <form
      className="mt-10 flex max-w-md flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const value = receipt.trim();
        if (!value) return;
        window.location.href = `/download?receipt=${encodeURIComponent(value)}`;
      }}
    >
      <label className="text-[0.65rem] font-medium tracking-[0.2em] text-subtle uppercase">
        Receipt token
        <input
          value={receipt}
          onChange={(event) => setReceipt(event.target.value)}
          className="mt-2 block h-12 w-full border border-border bg-elevated px-4 text-sm tracking-normal text-fg normal-case outline-none focus:border-accent"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <button
        type="submit"
        className="inline-flex h-12 w-fit items-center bg-accent px-7 text-xs font-medium tracking-[0.2em] text-bg uppercase"
      >
        Redeem
      </button>
    </form>
  );
}
