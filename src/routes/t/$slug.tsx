import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HermesNote } from "@/components/hermes-note";
import { displayMasterPricePence, trackIsForSale } from "@/lib/masters";
import { publicOrigin, shareMetaTags, shareTabletUrl } from "@/lib/og-card";
import { getMeaning, getTrackBySlug } from "@/lib/rooms";
import { jsonLdMeta, tabletJsonLd } from "@/lib/seo";
import { homeOgCard } from "@/lib/share";
import { tabletPagePath } from "@/lib/tablet-link";

/**
 * Crawler-facing share URL. WhatsApp / X / Facebook do not run JS and some
 * of them skip query-string SSR on `/?tablet=`, so this path server-renders
 * the track meta, then sends humans to the wall.
 */
export const Route = createFileRoute("/t/$slug")({
  head: ({ params }) => {
    const track = getTrackBySlug(params.slug);
    const origin = publicOrigin();
    if (!track) {
      const card = homeOgCard({
        source: "none",
        title: "Atman Music",
        meaning: "",
        image: "/og.jpg",
        slug: params.slug,
        origin,
      });
      return {
        meta: [{ title: card.title }, ...shareMetaTags(card)],
      };
    }
    const meaning = getMeaning(track.id);
    const card = homeOgCard({
      source: "tablet",
      title: track.title,
      meaning,
      image: track.image,
      slug: track.slug,
      origin,
    });
    const shareUrl = shareTabletUrl(track.slug, origin);
    const tags = shareMetaTags({ ...card, url: shareUrl }, card.description);
    return {
      meta: [
        { title: card.title },
        { name: "description", content: card.description },
        { name: "robots", content: "noindex, follow" },
        ...tags,
        jsonLdMeta(
          tabletJsonLd({
            track,
            meaning,
            pricePence: trackIsForSale(track) ? displayMasterPricePence() : undefined,
          }),
        ),
      ],
      links: [{ rel: "canonical", href: card.url }],
    };
  },
  component: ShareTabletPage,
});

function ShareTabletPage() {
  const { slug } = Route.useParams();
  const track = getTrackBySlug(slug);
  const href = tabletPagePath({ tablet: track?.slug ?? slug });

  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center text-fg">
      <a href={href} className="inline-flex items-center gap-2 font-display text-sm tracking-[0.16em] uppercase">
        <HermesNote size="mark" />
        Atman Music
      </a>
      <h1 className="mt-6 font-display text-3xl tracking-tight">
        {track?.title ?? "Opening the tablet"}
      </h1>
      <a href={href} className="mt-8 text-sm tracking-[0.16em] text-accent uppercase">
        Continue to the wall
      </a>
    </main>
  );
}
