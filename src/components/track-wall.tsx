import { useEffect, useState } from "react";
import { Pause, Play, Dices } from "lucide-react";
import { AccountNudge } from "@/components/account-nudge";
import { AtmanWord } from "@/components/atman-word";
import { DailyRite } from "@/components/daily-rite";
import { HermesNote } from "@/components/hermes-note";
import { MarksPulse } from "@/components/marks-pulse";
import { BuyMasterButton } from "@/components/buy-master";
import { HeartButton, ShareButton, ShareDayButton } from "@/components/track-actions";
import { FavoritesShelf } from "@/components/favorites-shelf";
import { MarkButton } from "@/components/mark-button";
import { ReadButton } from "@/components/read-button";
import { dailyTrackId } from "@/lib/daily-catalog";
import { useHearts } from "@/lib/hearts";
import { savedTablets } from "@/lib/saved-tablets";
import { useMarksFeed } from "@/lib/marks-feed";
import { usePlayBoard } from "@/lib/play-board";
import { TRACKS, getMeaning, type Track } from "@/lib/rooms";
import { usePlayer } from "@/lib/player-store";
import { noteUserGesture } from "@/lib/sc-widget";
import { playControlFace, playControlShowsPause } from "@/lib/playback";
import { cn } from "@/lib/utils";

export function TrackWall() {
  const entered = usePlayer((s) => s.entered);
  const currentId = usePlayer((s) => s.currentId);
  const playing = usePlayer((s) => s.playing);
  const playPending = usePlayer((s) => s.playPending);
  const playError = usePlayer((s) => s.playError);
  const toggleTrack = usePlayer((s) => s.toggleTrack);
  const spinTablet = usePlayer((s) => s.spinTablet);
  const hydrateMarks = useMarksFeed((s) => s.hydrate);
  const namedMarks = usePlayBoard((s) => s.namedMarks);
  const listenMarks = usePlayBoard((s) => s.recent);
  const recent = [...namedMarks, ...listenMarks].slice(0, 12);
  const hearts = useHearts((s) => s.ids);
  const [savedOnly, setSavedOnly] = useState(false);
  const dailyId = dailyTrackId();
  const current = TRACKS.find((t) => t.id === currentId) ?? TRACKS[0];
  const isDaily = current?.id === dailyId;
  const face = playControlFace({ playing, playPending, playError });
  const showPause = playControlShowsPause(face);
  const saved = savedTablets(TRACKS, hearts);
  const tiles = savedOnly ? saved : TRACKS;

  useEffect(() => {
    void hydrateMarks();
  }, [hydrateMarks]);

  return (
    <section id="top" className="relative">
      <div className="relative isolate min-h-dvh overflow-x-clip overflow-hidden">
        {current ? (
          <img
            src={current.image}
            alt=""
            className="absolute inset-0 size-full object-cover outline-none brightness-110"
          />
        ) : null}
        <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/55 to-bg/30" />
        <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col justify-end px-5 pb-[calc(10.5rem+env(safe-area-inset-bottom))] pt-[calc(6.5rem+env(safe-area-inset-top))] sm:px-8 sm:pb-32">
          <p className="text-xs font-medium tracking-[0.42em] text-accent uppercase">
            Atman Music · {TRACKS.length} tablets
            {isDaily ? " · Today's tablet" : ""}
          </p>
          <h1 className="mt-4">
            {entered ? (
              <HermesNote playing={playing} align="start" />
            ) : (
              <AtmanWord align="start" />
            )}
          </h1>
          {current ? (
            <p className="mt-5 max-w-lg line-clamp-4 whitespace-pre-line text-lead font-light text-fg/85">
              {getMeaning(current.id)}
            </p>
          ) : null}
          {current ? (
            <div className="mt-8 flex flex-wrap items-center gap-2 sm:mt-10">
              <button
                type="button"
                onPointerDown={noteUserGesture}
                onClick={() => toggleTrack(current.id)}
                className="inline-flex h-12 w-fit touch-manipulation items-center gap-2 bg-accent px-7 text-xs font-medium tracking-[0.2em] text-bg uppercase transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96]"
              >
                {showPause ? (
                  <>
                    <Pause className="size-3.5" fill="currentColor" />
                    {face === "pending" ? "Sounding" : "Pause"}
                  </>
                ) : (
                  <>
                    <Play className="ml-px size-3.5" fill="currentColor" />
                    {face === "retry" ? "Try again" : "Play"}{" "}
                    <span className="hidden sm:inline">{current.title}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onPointerDown={noteUserGesture}
                onClick={() => {
                  document.getElementById("wheel")?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                  spinTablet();
                }}
                className="inline-flex h-12 w-fit touch-manipulation items-center gap-2 bg-elevated px-5 text-xs font-medium tracking-[0.2em] text-fg uppercase transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96]"
              >
                <Dices className="size-3.5" />
                Random
              </button>
              <ReadButton trackId={current.id} className="bg-elevated" />
              <HeartButton id={current.id} className="bg-elevated" />
              {isDaily ? (
                <ShareDayButton track={current} className="h-12" />
              ) : (
                <ShareButton track={current} className="bg-elevated" />
              )}
              <MarkButton trackId={current.id} className="bg-elevated" labeled />
              <BuyMasterButton track={current} />
            </div>
          ) : null}
        </div>
      </div>

      <DailyRite />

      <FavoritesShelf
        saved={saved}
        currentId={currentId}
        playing={playing}
        dailyId={dailyId}
        onToggle={toggleTrack}
      />

      <div id="work" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
          <p className="text-xs font-medium tracking-[0.32em] text-accent uppercase">
            The wall
          </p>
          <h2 className="mt-3 font-display text-section text-fg">
            No genre. The lyric keeps the secret.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted">
            Open a tablet and read the meaning. The filing is the verse, not the
            style.
          </p>
          <AccountNudge className="mt-4 max-w-lg" />
          <WallFilter
            savedOnly={savedOnly}
            savedCount={saved.length}
            onChange={setSavedOnly}
          />
          {recent.length > 0 ? (
            <div className="mt-8 max-w-2xl">
              <MarksPulse recent={recent} compact />
            </div>
          ) : null}
        </div>

        <ul className="mx-auto grid max-w-6xl grid-cols-2 border-t border-border lg:grid-cols-3 xl:grid-cols-4">
          {tiles.length === 0 ? (
            <li className="col-span-full border-border px-5 py-12 text-sm text-muted sm:px-8">
              No saved tablets yet. Heart one on the wall.
            </li>
          ) : (
            tiles.map((track) => (
              <TabletTile
                key={track.id}
                track={track}
                active={track.id === currentId}
                isPlaying={track.id === currentId && playing}
                isDaily={track.id === dailyId}
                onToggle={() => toggleTrack(track.id)}
              />
            ))
          )}
        </ul>
      </div>
    </section>
  );
}

function TabletTile({
  track,
  active,
  isPlaying,
  isDaily,
  onToggle,
}: {
  track: Track;
  active: boolean;
  isPlaying: boolean;
  isDaily: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="relative">
      <button
        type="button"
        data-tablet-id={track.id}
        onPointerDown={noteUserGesture}
        onClick={onToggle}
        className="group relative block w-full overflow-hidden text-left"
      >
        <img
          src={track.image}
          alt=""
          loading="lazy"
          className="aspect-square w-full object-cover outline-none transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
        />
        <div
          className={cn(
            "absolute inset-0 bg-linear-to-t from-bg via-bg/20 to-transparent transition-opacity duration-200",
            isPlaying ? "opacity-100" : "opacity-80 group-hover:opacity-90",
          )}
        />
        {active ? (
          <span className="absolute inset-0 ring-2 ring-accent ring-inset" />
        ) : null}
        <span className="absolute inset-x-0 bottom-0 z-[6] p-2.5 sm:p-4">
          <span className="block truncate font-display text-base leading-tight text-fg sm:text-xl">
            {track.title}
          </span>
          <span
            className={cn(
              "mt-1.5 line-clamp-2 text-[0.7rem] leading-relaxed text-fg/80 transition-opacity duration-200 sm:mt-2 sm:line-clamp-3 sm:text-xs",
              active
                ? "opacity-100"
                : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100",
            )}
          >
            {getMeaning(track.id)}
          </span>
        </span>
      </button>
      {/*
        Outside the tile <button> (Buy is itself a <button> — nesting caused
        React #418). Row 1: Today | icon strip. Row 2: Buy full width under the
        strip so it is never covered. Daily tiles pack four icons 2×2 on mobile.
        pointer-events-none on the shell lets taps on Today fall through to play.
      */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-1 gap-y-1.5 p-1.5 sm:p-2">
        <div className="min-w-0">
          {isDaily ? (
            <span className="inline-block bg-accent px-2 py-1 text-[0.6rem] font-medium tracking-[0.16em] text-bg uppercase">
              Today
            </span>
          ) : null}
        </div>
        <div
          className={cn(
            "pointer-events-auto shrink-0 -mt-0.5 -mr-0.5 sm:mt-0 sm:mr-0",
            // Four icons on a phone tile need a 2×2 pack; from sm a row fits.
            isDaily ? "grid grid-cols-2 sm:flex" : "flex",
          )}
        >
          <ReadButton
            trackId={track.id}
            className="size-8 bg-bg/55 text-fg sm:size-10"
          />
          <HeartButton
            id={track.id}
            className="size-8 bg-bg/55 text-fg sm:size-10"
          />
          <ShareButton
            track={track}
            className={cn(
              "size-8 bg-bg/55 text-fg sm:size-10",
              isDaily ? "flex" : "hidden",
            )}
          />
          <MarkButton
            trackId={track.id}
            className="size-8 bg-bg/55 text-fg sm:size-10"
          />
        </div>
        {/* Full-width under the icon row so the price is never clipped by the strip. */}
        <div className="col-span-2 min-w-0 [&_button]:pointer-events-auto">
          <BuyMasterButton track={track} variant="card" />
        </div>
      </div>
    </li>
  );
}

function WallFilter({
  savedOnly,
  savedCount,
  onChange,
}: {
  savedOnly: boolean;
  savedCount: number;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={!savedOnly}
        onClick={() => onChange(false)}
        className={cn(
          "inline-flex h-10 items-center px-4 text-[0.65rem] font-medium tracking-[0.2em] uppercase transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.96]",
          savedOnly ? "bg-elevated text-fg" : "bg-accent text-bg",
        )}
      >
        All tablets
      </button>
      <button
        type="button"
        aria-pressed={savedOnly}
        onClick={() => onChange(true)}
        className={cn(
          "inline-flex h-10 items-center px-4 text-[0.65rem] font-medium tracking-[0.2em] uppercase transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.96]",
          savedOnly ? "bg-accent text-bg" : "bg-elevated text-fg",
        )}
      >
        Saved{savedCount > 0 ? ` · ${savedCount}` : ""}
      </button>
    </div>
  );
}
