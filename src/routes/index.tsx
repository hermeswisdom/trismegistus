import { createFileRoute } from "@tanstack/react-router";
import { About } from "@/components/about";
import { EnterGate } from "@/components/enter-gate";
import { FavoritesSync } from "@/components/favorites-sync";
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
import { getMeaning, getTrack } from "@/lib/rooms";
import { homeOgCard } from "@/lib/share";
import { parseHomeSearch } from "@/lib/tablet-link";

export const Route = createFileRoute("/")({
  validateSearch: parseHomeSearch,
  head: ({ match }) => {
    const focus = focusedTrackFromSearch(match.search);
    const track = getTrack(focus.trackId);
    if (!track) return {};
    const card = homeOgCard({
      source: focus.source,
      title: track.title,
      meaning: getMeaning(track.id),
      image: track.image,
      slug: track.slug,
    });
    return {
      meta: [
        { title: card.title },
        { name: "description", content: card.description },
        { property: "og:title", content: card.title },
        { property: "og:description", content: card.description },
        { property: "og:image", content: card.image },
        { property: "og:image:alt", content: card.imageAlt },
        { property: "og:url", content: card.url },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: card.siteName },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: card.title },
        { name: "twitter:description", content: card.description },
        { name: "twitter:image", content: card.image },
      ],
    };
  },
  component: Home,
});

function Home() {
  const search = Route.useSearch();
  return (
    <>
      <div className="grain" aria-hidden="true" />
      <LastTabletSync search={search} />
      <FavoritesSync />
      <MarksBoardSync />
      <EnterGate />
      <SiteHeader />
      <main id="wall-main" tabIndex={-1} className="outline-none">
        <TrackWall />
        <SongWheel />
        <Leaderboard />
        <About />
        <Signal />
      </main>
      <SiteFooter />
      <NowPlaying />
      <MarksSheet />
      <MeaningSheet />
    </>
  );
}
