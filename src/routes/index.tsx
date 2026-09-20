import { createFileRoute } from "@tanstack/react-router";
import { About } from "@/components/about";
import { EnterGate } from "@/components/enter-gate";
import { Leaderboard } from "@/components/leaderboard";
import { MarksSheet } from "@/components/marks-sheet";
import { ScreenMarkDrift } from "@/components/mark-drift";
import { NowPlaying } from "@/components/now-playing";
import { Signal } from "@/components/signal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SongWheel } from "@/components/song-wheel";
import { TrackWall } from "@/components/track-wall";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <>
      <div className="grain" aria-hidden="true" />
      <EnterGate />
      <SiteHeader />
      <main>
        <TrackWall />
        <SongWheel />
        <Leaderboard />
        <About />
        <Signal />
      </main>
      <SiteFooter />
      <NowPlaying />
      <ScreenMarkDrift />
      <MarksSheet />
    </>
  );
}
