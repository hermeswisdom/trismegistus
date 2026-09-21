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

function riteNumeral(n: number): string {
  const glyphs = [
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
  ];
  return glyphs[n - 1] ?? String(n);
}

export function useListenStreak(dailyId: string): number {
  const currentId = usePlayer((s) => s.currentId);
  const elapsed = usePlayer((s) => s.elapsed);
  const playing = usePlayer((s) => s.playing);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setStreak(readStreak(londonDateKey(new Date())).count);
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
    setStreak(next.count);
  }, [playing, currentId, dailyId, elapsed]);

  return streak;
}

export function DailyRite() {
  const daily = dailyTrack();
  const play = usePlayer((s) => s.play);
  const pause = usePlayer((s) => s.pause);
  const currentId = usePlayer((s) => s.currentId);
  const playing = usePlayer((s) => s.playing);
  const streak = useListenStreak(daily.id);
  const isPlaying = currentId === daily.id && playing;
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
          onClick={() => (isPlaying ? pause() : play(daily.id))}
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
              onClick={() => (isPlaying ? pause() : play(daily.id))}
              className="inline-flex h-11 w-fit items-center gap-2 bg-accent px-5 text-xs font-medium tracking-[0.2em] text-bg uppercase transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96]"
            >
              {isPlaying ? (
                <>
                  <Pause className="size-3.5" fill="currentColor" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="ml-px size-3.5" fill="currentColor" />
                  Listen
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
            <span className="px-2 text-xs tracking-[0.16em] text-subtle uppercase">
              {streak > 0
                ? `Rite · ${riteNumeral(streak)}`
                : "Thirty seconds writes the day"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
