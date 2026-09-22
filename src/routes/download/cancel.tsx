import { createFileRoute, Link } from "@tanstack/react-router";
import { HermesNote } from "@/components/hermes-note";
import { getTrack } from "@/lib/rooms";

function parseCancelSearch(search: Record<string, unknown>): {
  track?: string;
} {
  return {
    track: typeof search.track === "string" ? search.track : undefined,
  };
}

export const Route = createFileRoute("/download/cancel")({
  validateSearch: parseCancelSearch,
  component: DownloadCancelPage,
  head: () => ({
    meta: [{ title: "Checkout cancelled — Atman Music" }],
  }),
});

function DownloadCancelPage() {
  const { track: trackId } = Route.useSearch();
  const track = trackId ? getTrack(trackId) : undefined;

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
          Checkout
        </p>
        <h1 className="mt-3 max-w-xl font-display text-section text-fg">
          No charge. The stream stays free.
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base">
          {track
            ? `${track.title} is still on the wall. Buy again when you want the raw master.`
            : "The tablet is still on the wall. Buy again when you want the raw master."}
        </p>
        <Link
          to="/"
          search={track ? { tablet: track.slug } : undefined}
          className="mt-10 inline-flex h-12 w-fit items-center gap-2 bg-accent px-7 text-xs font-medium tracking-[0.2em] text-bg uppercase transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.96]"
        >
          Back to the wall
        </Link>
      </div>
    </main>
  );
}
