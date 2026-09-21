import { useEffect, useRef } from "react";
import { usePlayer } from "@/lib/player-store";
import { atmanGlow } from "@/lib/atman-glow";
import { getTrack } from "@/lib/rooms";
import { getLiveWidget } from "@/lib/sc-widget";
import { hydrateWaveform, sampleWave, useWaveform, waveBars } from "@/lib/waveform";
import { cn } from "@/lib/utils";

const BAR_COUNT = 36;

export function AtmanWord({
  align = "center",
  as: Tag = "span",
}: {
  align?: "center" | "start";
  as?: "span" | "h1";
}) {
  const playing = usePlayer((s) => s.playing);
  const playPending = usePlayer((s) => s.playPending);
  const elapsed = usePlayer((s) => s.elapsed);
  const duration = usePlayer((s) => s.duration);
  const currentId = usePlayer((s) => s.currentId);
  const soundId = getTrack(currentId)?.soundId;
  const wave = useWaveform(soundId);
  const coreRef = useRef<HTMLSpanElement>(null);
  const live = {
    playing,
    playPending,
    elapsed,
    duration,
    wave,
  };
  const liveRef = useRef(live);
  liveRef.current = live;
  const bars = wave ? waveBars(wave, BAR_COUNT, elapsed, duration) : null;
  const liveLook = playing || playPending;

  useEffect(() => {
    const widget = getLiveWidget();
    if (widget) hydrateWaveform(widget);
  }, [soundId, playing, playPending]);

  useEffect(() => {
    const el = coreRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let running = true;

    const tick = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      if (document.hidden) return;
      const snap = liveRef.current;
      const glow = atmanGlow({
        playing: snap.playing,
        playPending: snap.playPending,
        hasWave: Boolean(snap.wave && snap.duration > 0),
        sample:
          snap.wave && snap.duration > 0
            ? sampleWave(snap.wave, snap.elapsed, snap.duration)
            : 0,
        nowMs: now,
        reduceMotion: reduce.matches,
      });
      el.dataset.atman = glow.mode;
      el.style.setProperty("--atman-level", String(glow.level));
      if (glow.mode === "idle") {
        el.style.removeProperty("transform");
      } else {
        el.style.transform = `scale(${(1 + glow.level * 0.045).toFixed(4)})`;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <Tag
      className={cn("hermes-word", align === "start" && "hermes-word-start")}
      aria-label="Atman Music"
    >
      <span
        ref={coreRef}
        className={cn("atman-core", liveLook && "is-live")}
        data-word="ATMAN"
        data-atman={liveLook ? "sounding" : "idle"}
        aria-hidden="true"
      >
        ATMAN
      </span>
      {liveLook && bars ? (
        <span className="atman-meter" aria-hidden="true">
          {bars.map((bar, i) => (
            <span
              key={i}
              className={cn(bar.now && liveLook && "is-now")}
              style={{ ["--v" as string]: bar.v }}
            />
          ))}
        </span>
      ) : null}
      <span className="atman-music" aria-hidden="true">
        MUSIC
      </span>
    </Tag>
  );
}
