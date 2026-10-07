import { Link, createFileRoute } from "@tanstack/react-router";
import { EbookPageBody } from "@/components/free-ebook";
import { HermesNote } from "@/components/hermes-note";
import { EBOOK_COVER, EBOOK_DESCRIPTION, EBOOK_PAGE_PATH, EBOOK_TITLE } from "@/lib/ebook";
import { ebookJsonLd, jsonLdMeta } from "@/lib/seo";
import { SITE_ORIGIN } from "@/lib/tablet-link";

const TITLE = `${EBOOK_TITLE} · free ebook · Atman Music`;
const PAGE_URL = `${SITE_ORIGIN}${EBOOK_PAGE_PATH}`;
const IMAGE = `${SITE_ORIGIN}${EBOOK_COVER.jpg}`;

export const Route = createFileRoute("/ebook")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: EBOOK_DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: EBOOK_DESCRIPTION },
      { property: "og:image", content: IMAGE },
      { property: "og:image:alt", content: EBOOK_COVER.alt },
      { property: "og:url", content: PAGE_URL },
      { property: "og:type", content: "book" },
      { property: "og:site_name", content: "Atman Music" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: EBOOK_DESCRIPTION },
      { name: "twitter:image", content: IMAGE },
      jsonLdMeta(ebookJsonLd()),
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: EbookPage,
});

function EbookPage() {
  return (
    <main className="min-h-dvh bg-bg px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-8">
      <div className="mx-auto max-w-5xl py-8 sm:py-14">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2 font-display text-sm tracking-[0.16em] text-fg uppercase"
        >
          <HermesNote size="mark" />
          Atman Music
        </Link>
        <div className="mt-10 sm:mt-14">
          <EbookPageBody />
        </div>
        <Link
          to="/"
          className="mt-14 inline-flex h-12 items-center text-xs font-medium tracking-[0.2em] text-muted uppercase transition-colors duration-150 hover:text-accent"
        >
          ← Back to the wall
        </Link>
      </div>
    </main>
  );
}
