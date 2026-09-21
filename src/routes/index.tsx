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
import { homeOgCopy } from "@/lib/share";
import { SITE_ORIGIN, parseHomeSearch, tabletPageUrl } from "@/lib/tablet-link";

export const Route = createFileRoute("/")({
  validateSearch: parseHomeSearch,
  head: ({ match }) => {
    const focus = focusedTrackFromSearch(match.search);
    const track = getTrack(focus.trackId);
    if (!track) return {};
    const copy = homeOgCopy({
      source: focus.source,
      title: track.title,
      meaning: getMeaning(track.id),
    });
    const daily = focus.source === "daily";
    const url =
      focus.source === "none"
        ? `${SITE_ORIGIN}/`
        : tabletPageUrl({
            daily,
            tablet: daily ? undefined : track.slug,
          });
    const image = `${SITE_ORIGIN}${track.image}`;
    return {
      meta: [
        { title: copy.title },
        { name: "description", content: copy.description },
        { property: "og:title", content: copy.title },
        { property: "og:description", content: copy.description },
        { property: "og:image", content: image },
        { property: "og:image:alt", content: `${track.title} — Atman Music` },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Atman Music" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: copy.title },
        { name: "twitter:description", content: copy.description },
        { name: "twitter:image", content: image },
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
