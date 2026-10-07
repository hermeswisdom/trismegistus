import { createFileRoute } from "@tanstack/react-router";
import { About } from "@/components/about";
import { AudioDebugPanel } from "@/components/audio-debug-panel";
import { EnterGate } from "@/components/enter-gate";
import { FavoritesSync } from "@/components/favorites-sync";
import { FreeEbook } from "@/components/free-ebook";
import { HealingSounds } from "@/components/healing-sounds";
import { LastTabletSync } from "@/components/last-tablet-sync";
import { Leaderboard } from "@/components/leaderboard";
import { MarksBoardSync } from "@/components/marks-board-sync";
import { MarksSheet } from "@/components/marks-sheet";
import { MeaningSheet } from "@/components/meaning-sheet";
import { NowPlaying } from "@/components/now-playing";
import { Signal } from "@/components/signal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SongWheel } from "@/components/song-wheel";
import { TrackWall } from "@/components/track-wall";
import { focusedTrackFromSearch } from "@/lib/daily-catalog";
import { displayMasterPricePence, trackIsForSale } from "@/lib/masters";
import { TRACKS, getMeaning, getTrack } from "@/lib/rooms";
import { homeCanonical, homeDescription, homeJsonLd, jsonLdMeta, tabletJsonLd } from "@/lib/seo";
import { homeOgCard } from "@/lib/share";
import { parseHomeSearch } from "@/lib/tablet-link";

export const Route = createFileRoute("/")({
  validateSearch: parseHomeSearch,
  head: ({ match }) => {
    const focus = focusedTrackFromSearch(match.search);
    const track = getTrack(focus.trackId);
    if (!track) return {};
    const meaning = getMeaning(track.id);
    const card = homeOgCard({
      source: focus.source,
      title: track.title,
      meaning,
      image: track.image,
      slug: track.slug,
    });
    const pricePence = displayMasterPricePence();
    // Bare home: the richer site description. Tablet / daily: the verse.
    const description =
      focus.source === "none"
        ? homeDescription({ trackCount: TRACKS.length, pricePence })
        : card.description;
    const canonical = homeCanonical({ source: focus.source, slug: track.slug });
    return {
      meta: [
        { title: card.title },
        { name: "description", content: description },
        { property: "og:title", content: card.title },
        { property: "og:description", content: description },
        { property: "og:image", content: card.image },
        { property: "og:image:alt", content: card.imageAlt },
        { property: "og:url", content: card.url },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: card.siteName },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: card.title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: card.image },
        jsonLdMeta(
          focus.source === "none"
            ? homeJsonLd(description)
            : tabletJsonLd({
                track,
                meaning,
                pricePence: trackIsForSale(track) ? pricePence : undefined,
              }),
        ),
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: Home,
});

function Home() {
  const search = Route.useSearch();
  // Server-rendered focus: a ?tablet= / ?daily=1 link renders that track's
  // name and meaning in the first HTML, before LastTabletSync runs.
  const focus = focusedTrackFromSearch(search);
  const focusId = focus.source === "none" ? undefined : focus.trackId;
  return (
    <>
      <div className="grain" aria-hidden="true" />
      <LastTabletSync search={search} />
      <FavoritesSync />
      <MarksBoardSync />
      <EnterGate />
      <SiteHeader />
      <main id="wall-main" tabIndex={-1} className="outline-none">
        <TrackWall focusId={focusId} />
        <SongWheel />
        <HealingSounds />
        <Leaderboard />
        <FreeEbook />
        <About />
        <Signal />
      </main>
      <SiteFooter />
      <NowPlaying />
      <AudioDebugPanel />
      <MarksSheet />
      <MeaningSheet />
    </>
  );
}
