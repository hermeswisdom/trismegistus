import { Link, createFileRoute } from "@tanstack/react-router";
import { HealingSounds } from "@/components/healing-sounds";
import { HermesNote } from "@/components/hermes-note";
import { BOWLS, BOWLS_DISCLAIMER, BOWLS_PATH } from "@/lib/bowls";
import { SITE_ORIGIN } from "@/lib/tablet-link";

const TITLE = "Sound bowls · Healing sounds · Atman Music";
const DESCRIPTION = `Twenty singing-bowl sittings — solfeggio, chakra, earth, and rest — synthesized in the browser. ${BOWLS_DISCLAIMER}`;
const PAGE_URL = `${SITE_ORIGIN}${BOWLS_PATH}`;

export const Route = createFileRoute("/bowls")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: PAGE_URL },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Atman Music" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: BowlsPage,
});

function BowlsPage() {
  return (
    <>
      <div className="grain" aria-hidden="true" />
      <main className="min-h-dvh bg-bg pb-[calc(7rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-6xl px-5 pt-[max(2rem,env(safe-area-inset-top))] sm:px-8">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-2 font-display text-sm tracking-[0.16em] text-fg uppercase"
          >
            <HermesNote size="mark" />
            Atman Music
          </Link>
        </div>
        <HealingSounds variant="page" />
        <div className="mx-auto max-w-6xl px-5 pb-10 sm:px-8">
          <p className="text-[0.7rem] tracking-[0.14em] text-subtle uppercase">
            {BOWLS.length} bowls · synthesized here · no recordings
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex h-12 items-center text-xs font-medium tracking-[0.2em] text-muted uppercase transition-colors duration-150 hover:text-accent"
          >
            ← Back to the wall
          </Link>
        </div>
      </main>
    </>
  );
}
