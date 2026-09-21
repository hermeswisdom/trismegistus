import { useLayoutEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { About } from "@/components/about";
import { EnterGate } from "@/components/enter-gate";
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
import { usePlayer } from "@/lib/player-store";
import { SITE_ORIGIN, parseHomeSearch, tabletPageUrl } from "@/lib/tablet-link";

export const Route = createFileRoute("/")({
  validateSearch: parseHomeSearch,
  head: ({ match }) => {
    const focus = focusedTrackFromSearch(match.search);
    const track = getTrack(focus.trackId);
    if (!track) return {};
    const meaning = getMeaning(track.id).replace(/\s+/g, " ").trim();
    const description = meaning.slice(0, 180);
    const daily = focus.source === "daily";
    const url =
      focus.source === "none"
        ? `${SITE_ORIGIN}/`
        : tabletPageUrl({
            daily,
            tablet: daily ? undefined : track.slug,
          });
    const title =
      focus.source === "none"
        ? "Atman Music — Esoteric Vibrations"
        : daily
          ? `Today's tablet — ${track.title} — Atman Music`
          : `${track.title} — Atman Music`;
    const image = `${SITE_ORIGIN}${track.image}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: image },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
    };
  },
  component: Home,
});

function FocusFromSearch() {
  const search = Route.useSearch();

  useLayoutEffect(() => {
    const focus = focusedTrackFromSearch(search);
    if (focus.source === "none") return;
    usePlayer.setState({ currentId: focus.trackId });
  }, [search]);

  return null;
}

function Home() {
  return (
    <>
      <div className="grain" aria-hidden="true" />
      <FocusFromSearch />
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
