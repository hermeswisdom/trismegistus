import { useEffect, useId, useRef } from "react";
import { AudioLines, Pause, Play, SkipForward, X } from "lucide-react";
import { noteUserGesture } from "@/lib/sc-widget";
import { getTrack } from "@/lib/rooms";
import { MOODS, type Mood } from "@/lib/automix/types";
import { unlockAutoMix, useAutoMix } from "@/lib/automix/store";
import { cn } from "@/lib/utils";

const MOOD_LABEL: Record<Mood, string> = {
  chill: "Chill",
  hype: "Hype",
  dark: "Dark",
  happy: "Happy",
  dreamy: "Dreamy",
  epic: "Epic",
};

export function AutoMixButton({ className }: { className?: string }) {
  const open = useAutoMix((s) => s.open);
  const playing = useAutoMix((s) => s.playing);
  const openPanel = useAutoMix((s) => s.openPanel);
  const closePanel = useAutoMix((s) => s.closePanel);

  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls="automix-panel"
      onPointerDown={() => {
        noteUserGesture();
        unlockAutoMix();
      }}
      onClick={() => (open ? closePanel() : openPanel())}
      className={cn(
        "inline-flex h-12 w-fit touch-manipulation items-center gap-2 px-5 text-xs font-medium tracking-[0.2em] uppercase transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96]",
        open || playing ? "bg-accent text-bg" : "bg-elevated text-fg",
        className,
      )}
    >
      <AudioLines className="size-3.5" />
      Auto Mix
    </button>
  );
}

export function AutoMixDock() {
  const open = useAutoMix((s) => s.open);
  const playing = useAutoMix((s) => s.playing);
  const pending = useAutoMix((s) => s.pending);
  const visible = open || playing || pending;
  if (!visible) return null;
  return <AutoMixPanel />;
}

function AutoMixPanel() {
  const panelId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const open = useAutoMix((s) => s.open);
  const mood = useAutoMix((s) => s.mood);
  const energy = useAutoMix((s) => s.energy);
  const endless = useAutoMix((s) => s.endless);
  const playing = useAutoMix((s) => s.playing);
  const pending = useAutoMix((s) => s.pending);
  const error = useAutoMix((s) => s.error);
  const now = useAutoMix((s) => s.now);
  const next = useAutoMix((s) => s.next);
  const xfade = useAutoMix((s) => s.xfade);
  const setMood = useAutoMix((s) => s.setMood);
  const setEnergy = useAutoMix((s) => s.setEnergy);
  const setEndless = useAutoMix((s) => s.setEndless);
  const toggle = useAutoMix((s) => s.toggle);
  const skip = useAutoMix((s) => s.skip);
  const closePanel = useAutoMix((s) => s.closePanel);
  const openPanel = useAutoMix((s) => s.openPanel);
  const stop = useAutoMix((s) => s.stop);
  const nowTrack = now ? getTrack(now.slug) : undefined;
  const nextTrack = next ? getTrack(next.slug) : undefined;
  const expanded = open;

  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePanel();
        return;
      }
      const root = document.getElementById("automix-panel");
      if (!root || !root.contains(e.target as Node)) return;
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === " " && tag !== "INPUT" && tag !== "BUTTON" && tag !== "TEXTAREA") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        skip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePanel, skip, toggle]);

  function onPlay() {
    noteUserGesture();
    unlockAutoMix();
    toggle();
  }

  function onSkip() {
    noteUserGesture();
    skip();
  }

  return (
    <div
      id="automix-panel"
      role="region"
      aria-labelledby={panelId}
      data-automix=""
      data-automix-open={open ? "true" : "false"}
      data-automix-playing={playing ? "true" : "false"}
      data-automix-mood={mood ?? ""}
      data-automix-now={now?.slug ?? ""}
      data-automix-next={next?.slug ?? ""}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md"
    >
      <div
        className="h-0.5 w-full bg-elevated"
        aria-hidden={xfade == null}
      >
        <span
          className="block h-full origin-left bg-accent"
          style={{ transform: `scaleX(${xfade ?? 0})` }}
        />
      </div>
      <div className="mx-auto max-w-6xl px-3 pt-2 sm:px-8">
        <div className="flex items-center gap-2">
          <h2
            id={panelId}
            ref={headingRef}
            tabIndex={-1}
            className="min-w-0 flex-1 truncate text-[0.65rem] font-medium tracking-[0.28em] text-accent uppercase outline-none"
          >
            {expanded ? (
              <>Auto Mix{mood ? ` · ${MOOD_LABEL[mood]}` : ""}</>
            ) : (
              <button
                type="button"
                onClick={() => openPanel()}
                className="truncate tracking-[0.28em] uppercase"
              >
                Auto Mix{mood ? ` · ${MOOD_LABEL[mood]}` : ""}
              </button>
            )}
          </h2>
          {playing || pending ? (
            <button
              type="button"
              onClick={() => stop()}
              className="h-9 px-2 text-[0.6rem] font-medium tracking-[0.18em] text-muted uppercase hover:text-fg"
            >
              Stop
            </button>
          ) : null}
          {expanded ? (
            <button
              type="button"
              onClick={() => closePanel()}
              className="flex size-9 touch-manipulation items-center justify-center text-muted hover:text-fg"
              aria-label="Hide Auto Mix"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {expanded ? (
          <>
            <div
              role="radiogroup"
              aria-label="Mood"
              className="mt-2 flex flex-wrap gap-1.5"
            >
              {MOODS.map((m) => {
                const selected = mood === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onPointerDown={noteUserGesture}
                    onClick={() => setMood(m)}
                    className={cn(
                      "inline-flex h-9 min-w-11 touch-manipulation items-center justify-center px-2.5 text-[0.65rem] font-medium tracking-[0.16em] uppercase transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.96]",
                      selected ? "bg-accent text-bg" : "bg-elevated text-fg",
                    )}
                  >
                    {MOOD_LABEL[m]}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex min-w-0 flex-1 items-center gap-3 text-[0.65rem] tracking-[0.16em] text-muted uppercase">
                Energy
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(energy * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(energy * 100)}
                  onChange={(e) => setEnergy(Number(e.target.value) / 100)}
                  className="automix-energy min-w-0 flex-1"
                />
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={endless}
                onClick={() => setEndless(!endless)}
                className={cn(
                  "inline-flex h-9 items-center px-3 text-[0.65rem] font-medium tracking-[0.16em] uppercase transition-[transform,opacity] duration-150",
                  endless ? "bg-accent text-bg" : "bg-elevated text-fg",
                )}
              >
                Endless
              </button>
            </div>
          </>
        ) : null}

        {error ? (
          <p className="mt-2 text-[0.7rem] tracking-[0.16em] text-accent uppercase">
            {error}
          </p>
        ) : null}

        <div className="mt-2 flex items-center gap-2 py-1">
          {nowTrack ? (
            <img
              src={nowTrack.image}
              alt=""
              className="size-11 shrink-0 object-cover sm:size-12"
            />
          ) : (
            <span className="size-11 shrink-0 bg-elevated sm:size-12" />
          )}
          <div className="min-w-0 flex-1">
            <p
              className="truncate font-display text-[0.95rem] italic text-fg"
              aria-live="polite"
            >
              {now?.title ?? (mood ? "Pick play" : "Pick a mood")}
            </p>
            <p className="truncate text-[0.7rem] tracking-wider text-subtle">
              {next
                ? `Up next · ${nextTrack?.title ?? next.title}`
                : endless
                  ? "Up next · mixing"
                  : "Up next · end of mix"}
            </p>
          </div>
          <button
            type="button"
            onPointerDown={() => {
              noteUserGesture();
              unlockAutoMix();
            }}
            onClick={onPlay}
            disabled={!mood && !now}
            className="flex size-11 shrink-0 touch-manipulation items-center justify-center bg-accent text-bg transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96] disabled:opacity-40"
            aria-label={playing || pending ? "Pause Auto Mix" : "Play Auto Mix"}
          >
            {playing || pending ? (
              <Pause className="size-4" fill="currentColor" />
            ) : (
              <Play className="ml-px size-4" fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            onPointerDown={noteUserGesture}
            onClick={onSkip}
            disabled={!playing && !pending}
            className="flex size-11 shrink-0 touch-manipulation items-center justify-center text-muted transition-colors duration-150 hover:text-fg disabled:opacity-40"
            aria-label="Skip track"
          >
            <SkipForward className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
