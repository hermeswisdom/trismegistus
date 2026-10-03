import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pause, Play } from "lucide-react";
import {
  BOWLS,
  BOWLS_DISCLAIMER,
  BOWLS_PATH,
  BOWLS_SECTION_ID,
  BOWL_KINDS,
  BOWL_TIMERS,
  bowlMetaLine,
  type Bowl,
  type BowlKind,
} from "@/lib/bowls";
import { useBowlPlayer } from "@/lib/bowl-player";
import { cn, formatElapsed } from "@/lib/utils";

function BowlMark({ bowl, playing }: { bowl: Bowl; playing: boolean }) {
  const rings = bowl.voice === "binaural" ? 4 : 3;
  return (
    <span
      className={cn("bowl-mark", playing && "bowl-mark-playing")}
      aria-hidden="true"
      data-bowl-voice={bowl.voice}
    >
      {Array.from({ length: rings }, (_, i) => (
        <span key={i} style={{ inset: `${10 + i * 18}%` }} />
      ))}
    </span>
  );
}

function TimerPills({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number;
  onChange: (minutes: number) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="radiogroup"
      aria-label="Listening timer"
    >
      {BOWL_TIMERS.map((timer) => {
        const selected = timer.minutes === value;
        return (
          <button
            key={timer.minutes}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(timer.minutes)}
            className={cn(
              "inline-flex h-9 min-w-11 touch-manipulation items-center justify-center px-2.5 text-[0.65rem] font-medium tracking-[0.16em] uppercase transition-[transform,opacity,background-color] duration-150",
              selected ? "bg-fg text-bg" : "hairline text-muted hover:text-fg",
            )}
            data-bowl-timer={timer.minutes}
            data-bowl-id={id}
          >
            {timer.label}
          </button>
        );
      })}
    </div>
  );
}

function BowlCard({ bowl }: { bowl: Bowl }) {
  const currentId = useBowlPlayer((s) => s.currentId);
  const playing = useBowlPlayer((s) => s.playing);
  const volume = useBowlPlayer((s) => s.volume);
  const timerMin = useBowlPlayer((s) => s.timerMin);
  const remainingSec = useBowlPlayer((s) => s.remainingSec);
  const toggle = useBowlPlayer((s) => s.toggle);
  const setVolume = useBowlPlayer((s) => s.setVolume);
  const setTimer = useBowlPlayer((s) => s.setTimer);
  const active = currentId === bowl.id;
  const isPlaying = active && playing;

  return (
    <article
      className={cn(
        "flex flex-col border border-border bg-bg/40 p-5 transition-[box-shadow,border-color] duration-200 sm:p-6",
        isPlaying && "shadow-border-hover",
      )}
      data-bowl-card={bowl.id}
      data-bowl-playing={isPlaying ? "true" : "false"}
    >
      <div className="flex items-start gap-4">
        <BowlMark bowl={bowl} playing={isPlaying} />
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-medium tracking-[0.26em] text-accent uppercase">
            {bowlMetaLine(bowl)}
          </p>
          <h3 className="mt-2 font-display text-2xl text-fg">{bowl.name}</h3>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">{bowl.use}</p>
      <p className="mt-3 text-sm leading-relaxed text-subtle">{bowl.listen}</p>
      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => toggle(bowl.id)}
            className="inline-flex h-12 min-w-28 touch-manipulation items-center justify-center gap-2 bg-accent px-5 text-xs font-medium tracking-[0.2em] text-bg uppercase transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.97]"
            aria-label={isPlaying ? `Pause ${bowl.name}` : `Play ${bowl.name}`}
            data-bowl-play={bowl.id}
          >
            {isPlaying ? (
              <Pause className="size-3.5" fill="currentColor" />
            ) : (
              <Play className="ml-px size-3.5" fill="currentColor" />
            )}
            {isPlaying ? "Pause" : "Play"}
          </button>
          {active && remainingSec !== null ? (
            <p className="text-[0.7rem] tracking-[0.16em] text-subtle uppercase">
              {formatElapsed(remainingSec)} left
            </p>
          ) : active && isPlaying ? (
            <p className="text-[0.7rem] tracking-[0.16em] text-subtle uppercase">
              Loop
            </p>
          ) : null}
        </div>
        <label className="block">
          <span className="mb-2 block text-[0.65rem] tracking-[0.2em] text-subtle uppercase">
            Volume
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="bowl-volume h-11 w-full max-w-xs touch-manipulation"
            aria-label={`Volume for ${bowl.name}`}
          />
        </label>
        <TimerPills id={bowl.id} value={timerMin} onChange={setTimer} />
      </div>
    </article>
  );
}

function BowlDock() {
  const currentId = useBowlPlayer((s) => s.currentId);
  const playing = useBowlPlayer((s) => s.playing);
  const remainingSec = useBowlPlayer((s) => s.remainingSec);
  const timerMin = useBowlPlayer((s) => s.timerMin);
  const volume = useBowlPlayer((s) => s.volume);
  const toggle = useBowlPlayer((s) => s.toggle);
  const setVolume = useBowlPlayer((s) => s.setVolume);
  const bowl = currentId
    ? BOWLS.find((item) => item.id === currentId)
    : undefined;
  if (!bowl || !playing) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md"
      data-bowl-dock=""
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-3 sm:gap-4 sm:px-8">
        <BowlMark bowl={bowl} playing />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[0.95rem] italic text-fg sm:text-lg">
            {bowl.name}
          </p>
          <p className="truncate text-[0.7rem] tracking-wider text-subtle uppercase">
            {bowl.hzLabel}
            {remainingSec !== null
              ? ` · ${formatElapsed(remainingSec)} left`
              : timerMin === 0
                ? " · loop"
                : ""}
          </p>
        </div>
        <label className="hidden min-w-28 sm:block">
          <span className="sr-only">Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="bowl-volume h-11 w-full touch-manipulation"
          />
        </label>
        <button
          type="button"
          onClick={() => toggle(bowl.id)}
          className="flex size-11 shrink-0 touch-manipulation items-center justify-center bg-accent text-bg transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.96]"
          aria-label={`Pause ${bowl.name}`}
        >
          <Pause className="size-4" fill="currentColor" />
        </button>
      </div>
    </div>
  );
}

export function HealingSounds({
  variant = "section",
}: {
  variant?: "section" | "page";
}) {
  const [kind, setKind] = useState<BowlKind | "all">("all");
  const bowls = useMemo(
    () => (kind === "all" ? BOWLS : BOWLS.filter((b) => b.kind === kind)),
    [kind],
  );
  const Title = variant === "page" ? "h1" : "h2";

  return (
    <>
      <section
        id={variant === "section" ? BOWLS_SECTION_ID : undefined}
        className={cn(
          variant === "section" && "scroll-mt-24 border-t border-border",
        )}
        aria-labelledby="bowls-title"
        data-healing-sounds={variant}
      >
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-28">
          <p className="text-xs font-medium tracking-[0.32em] text-accent uppercase">
            Healing sounds
          </p>
          <Title
            id="bowls-title"
            className="mt-3 font-display text-section text-fg"
          >
            Sound bowls.
          </Title>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            An optional sitting, apart from the catalog. Pick one bowl. Each
            tone is synthesized here — a struck bronze voice with harmonics, a
            long decay, and a gentle loop. One bowl at a time.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-subtle">
            {BOWLS_DISCLAIMER}
          </p>
          {variant === "section" ? (
            <p className="mt-4">
              <Link
                to={BOWLS_PATH}
                className="text-[0.7rem] tracking-[0.14em] text-muted uppercase underline decoration-border underline-offset-4 transition-colors duration-150 hover:text-accent"
              >
                Open on its own page
              </Link>
            </p>
          ) : null}

          <div
            className="mt-10 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Bowl families"
          >
            {BOWL_KINDS.map((item) => {
              const selected = item.id === kind;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setKind(item.id)}
                  className={cn(
                    "inline-flex h-11 touch-manipulation items-center px-4 text-[0.7rem] font-medium tracking-[0.2em] uppercase transition-colors duration-150",
                    selected
                      ? "bg-fg text-bg"
                      : "hairline text-muted hover:text-fg",
                  )}
                  data-bowl-kind={item.id}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {bowls.map((bowl) => (
              <BowlCard key={bowl.id} bowl={bowl} />
            ))}
          </div>
        </div>
      </section>
      <BowlDock />
    </>
  );
}
