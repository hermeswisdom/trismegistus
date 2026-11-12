import { Link, createFileRoute } from "@tanstack/react-router";
import { HermesAtlas } from "@/components/hermes-atlas";
import { HermesNote } from "@/components/hermes-note";
import { HERMES_DESCRIPTION, HERMES_PATH, HERMES_TITLE } from "@/lib/hermes-atlas";
import { jsonLdMeta, pageBreadcrumbJsonLd } from "@/lib/seo";
import { SITE_ORIGIN } from "@/lib/tablet-link";

const TITLE = `${HERMES_TITLE} · Atman Music`;
const PAGE_URL = `${SITE_ORIGIN}${HERMES_PATH}`;

export const Route = createFileRoute("/hermes")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: HERMES_DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: HERMES_DESCRIPTION },
      { property: "og:url", content: PAGE_URL },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Atman Music" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: HERMES_DESCRIPTION },
      jsonLdMeta(pageBreadcrumbJsonLd("Hermes Atlas", HERMES_PATH)),
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: HermesPage,
});

function HermesPage() {
  return (
    <>
      <div className="grain" aria-hidden="true" />
      <main className="min-h-dvh min-w-0 overflow-x-clip bg-bg pb-[max(3rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-6xl px-5 pt-[max(2rem,env(safe-area-inset-top))] sm:px-8">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-2 font-display text-sm tracking-[0.16em] text-fg uppercase"
          >
            <HermesNote size="mark" />
            Atman Music
          </Link>
        </div>
        <HermesAtlas />
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
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
