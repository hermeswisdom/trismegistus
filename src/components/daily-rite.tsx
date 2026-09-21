import { useEffect, useState } from "react";
import { Check, Pause, Play, Share2 } from "lucide-react";
import { shareTabletPage } from "@/components/track-actions";
import { dailyTrack } from "@/lib/daily-catalog";
import { londonDateKey } from "@/lib/daily-tablet";
import {
  LISTEN_STREAK_SECONDS,
  markListenDay,
  readStreak,
  shouldCreditListen,
  writeStreak,
} from "@/lib/listen-streak";
import { getMeaning } from "@/lib/rooms";
import { usePlayer } from "@/lib/player-store";
import { noteUserGesture } from "@/lib/sc-widget";
import { playControlFace, playControlShowsPause } from "@/lib/playback";
import { wallStreakCopy } from "@/lib/streak-copy";

function useListenStreak(dailyId: string): {
  count: number;
  todayMarked: boolean;
} {
  const currentId = usePlayer((s) => s.currentId);
  const elapsed = usePlayer((s) => s.elapsed);
  const playing = usePlayer((s) => s.playing);
  const [streak, setStreak] = useState({ count: 0, todayMarked: false });

  useEffect(() => {
    const today = londonDateKey(new Date());
    const stored = readStreak(today);
    setStreak({
      count: stored.count,
      todayMarked: stored.days.includes(today),
    });
  }, []);

  useEffect(() => {
    if (
      !playing ||
      !shouldCreditListen({
        trackId: currentId,
        dailyId,
        elapsed,
        threshold: LISTEN_STREAK_SECONDS,
      })
    ) {
      return;
    }
    const today = londonDateKey(new Date());
    const stored = readStreak(today);
    if (stored.days.includes(today)) return;
    const next = markListenDay(stored.days, today);
    writeStreak(next);
    setStreak({ count: next.count, todayMarked: true });
  }, [playing, currentId, dailyId, elapsed]);

  return streak;
}

export function DailyRite() {
  const daily = dailyTrack();
  const toggleTrack = usePlayer((s) => s.toggleTrack);
  const currentId = usePlayer((s) => s.currentId);
  const playing = usePlayer((s) => s.playing);
  const playPending = usePlayer((s) => s.playPending);
  const playError = usePlayer((s) => s.playError);
  const streak = useListenStreak(daily.id);
  const copy = wallStreakCopy(streak);
  const dailyFace = playControlFace({
    playing: currentId === daily.id && playing,
    playPending: currentId === daily.id && playPending,
    playError: currentId === daily.id ? playError : null,
  });
  const isPlaying = playControlShowsPause(dailyFace);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  return (
    <aside id="daily" className="border-t border-border bg-elevated/35">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:px-8 sm:py-12">
        <button
          type="button"
          onPointerDown={noteUserGesture}
          onClick={() => toggleTrack(daily.id)}
          className="relative shrink-0 text-left"
          aria-label={isPlaying ? "Pause today's tablet" : "Play today's tablet"}
        >
          <img
            src={daily.image}
            alt=""
            className="size-28 object-cover sm:size-32"
          />
          <span className="absolute top-2 left-2 bg-accent px-2 py-1 text-[0.62rem] font-medium tracking-[0.18em] text-bg uppercase">
            Today
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-[0.32em] text-accent uppercase">
            Today&apos;s tablet
          </p>
          <h3 className="mt-2 font-display text-2xl leading-tight text-fg sm:text-3xl">
            {daily.title}
          </h3>
          <p className="mt-2 line-clamp-3 max-w-xl whitespace-pre-line text-sm leading-relaxed text-muted">
            {getMeaning(daily.id)}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onPointerDown={noteUserGesture}
              onClick={() => toggleTrack(daily.id)}
              className="inline-flex h-11 w-fit items-center gap-2 bg-accent px-5 text-xs font-medium tracking-[0.2em] text-bg uppercase transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96]"
            >
              {isPlaying ? (
                <>
                  <Pause className="size-3.5" fill="currentColor" />
                  {dailyFace === "pending" ? "Sounding" : "Pause"}
                </>
              ) : (
                <>
                  <Play className="ml-px size-3.5" fill="currentColor" />
                  {dailyFace === "retry" ? "Try again" : "Listen"}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={async () => {
                const ok = await shareTabletPage(daily, { daily: true });
                if (ok) setCopied(true);
              }}
              className="inline-flex h-11 w-fit items-center gap-2 bg-elevated px-5 text-xs font-medium tracking-[0.2em] text-fg uppercase transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96]"
            >
              {copied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
              {copied ? "Copied" : "Share the day"}
            </button>
          </div>
          <p className="mt-4 max-w-md text-xs tracking-[0.14em] text-subtle uppercase">
            <span className="text-accent">{copy.kicker}</span>
            <span className="mx-2 text-border">·</span>
            {copy.detail}
          </p>
        </div>
      </div>
    </aside>
  );
}
