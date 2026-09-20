import { useEffect, useRef, useState } from "react";
import { TRACKS, getMeaning, randomTrack, type Track } from "@/lib/rooms";
import { usePlayer } from "@/lib/player-store";
import { useWheelSpin } from "@/lib/wheel-spin";

const SEGMENTS = 12;
const SLICE = 360 / SEGMENTS;
const CX = 100;
const CY = 100;
const R = 100;

function polar(deg: number, radius: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [
    Number((CX + radius * Math.cos(rad)).toFixed(3)),
    Number((CY + radius * Math.sin(rad)).toFixed(3)),
  ] as const;
}

function wedgePath(index: number) {
  const a0 = index * SLICE;
  const a1 = (index + 1) * SLICE;
  const [x0, y0] = polar(a0, R);
  const [x1, y1] = polar(a1, R);
  return `M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1} Z`;
}

function shuffle<T>(list: T[]) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const hold = next[i]!;
    next[i] = next[j]!;
    next[j] = hold;
  }
  return next;
}

function buildSegments(winner: Track) {
  const pool = shuffle(TRACKS.filter((track) => track.id !== winner.id));
  const winIndex = Math.floor(Math.random() * SEGMENTS);
  const rest = pool.slice(0, SEGMENTS - 1);
  rest.splice(winIndex, 0, winner);
  return { segments: rest, winIndex };
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function SongWheel() {
  const play = usePlayer((s) => s.play);
  const currentId = usePlayer((s) => s.currentId);
  const nonce = useWheelSpin((s) => s.nonce);
  const [segments, setSegments] = useState<Track[]>(() => TRACKS.slice(0, SEGMENTS));
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState<Track | null>(null);
  const spinRef = useRef<{ winIndex: number; winner: Track } | null>(null);
  const spinningRef = useRef(false);

  useEffect(() => {
    spinningRef.current = spinning;
  }, [spinning]);

  useEffect(() => {
    if (!spinning) return;
    const id = window.setTimeout(() => {
      const spin = spinRef.current;
      setSpinning(false);
      if (!spin) return;
      setLanded(spin.winner);
      play(spin.winner.id);
    }, prefersReducedMotion() ? 0 : 4200);
    return () => window.clearTimeout(id);
  }, [spinning, play]);

  function spin() {
    if (spinningRef.current) return;
    const winner = randomTrack(currentId);
    const next = buildSegments(winner);
    setSegments(next.segments);
    setLanded(null);
    spinRef.current = { winIndex: next.winIndex, winner };

    if (prefersReducedMotion()) {
      setAngle(((SEGMENTS - next.winIndex) % SEGMENTS) * SLICE);
      setSpinning(true);
      return;
    }

    const base = Math.ceil(angle / 360) * 360;
    const landing = ((SEGMENTS - next.winIndex) % SEGMENTS) * SLICE;
    const turns = 5 + Math.floor(Math.random() * 3);
    setAngle(base);
    window.requestAnimationFrame(() => {
      setSpinning(true);
      setAngle(base + turns * 360 + landing);
    });
  }

  useEffect(() => {
    if (nonce === 0) return;
    spin();
  }, [nonce]);

  const meaning = landed ? getMeaning(landed.id) : undefined;

  return (
    <section id="wheel" className="border-t border-border">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_minmax(0,22rem)] lg:py-28">
        <div>
          <p className="text-xs font-medium tracking-[0.32em] text-accent uppercase">
            The wheel
          </p>
          <h2 className="mt-3 font-display text-section text-fg">
            Press. A tablet lands.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base">
            One hundred and two covers on a hidden axle. The pointer does not
            choose. The spin does.
          </p>
          {landed ? (
            <p className="mt-8 font-display text-2xl italic text-fg">
              {landed.title}
              <span className="mt-2 block line-clamp-4 whitespace-pre-line text-sm font-sans font-light tracking-normal text-muted not-italic normal-case">
                {meaning}
              </span>
            </p>
          ) : (
            <p className="mt-8 text-sm text-subtle">
              {spinning ? "The wheel is turning." : "No tablet yet."}
            </p>
          )}
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-sm">
          <span
            className="absolute top-0 left-1/2 z-20 -translate-x-1/2 -translate-y-1 text-accent"
            aria-hidden="true"
          >
            <svg width="22" height="26" viewBox="0 0 22 26">
              <polygon points="11,26 0,0 22,0" fill="currentColor" />
            </svg>
          </span>

          <div
            className="size-full rounded-full border border-border bg-elevated"
            style={{
              transform: `rotate(${angle}deg)`,
              transition: spinning
                ? "transform 4.2s cubic-bezier(0.12, 0.7, 0.08, 1)"
                : "none",
            }}
          >
            <svg viewBox="0 0 200 200" className="size-full">
              <defs>
                {segments.map((track, index) => (
                  <pattern
                    key={`pat-${track.id}-${index}`}
                    id={`wheel-art-${index}`}
                    patternUnits="userSpaceOnUse"
                    width="200"
                    height="200"
                  >
                    <image
                      href={track.image}
                      width="200"
                      height="200"
                      preserveAspectRatio="xMidYMid slice"
                    />
                  </pattern>
                ))}
              </defs>
              {segments.map((track, index) => (
                <path
                  key={`${track.id}-${index}`}
                  d={wedgePath(index)}
                  fill={`url(#wheel-art-${index})`}
                  stroke="var(--color-bg)"
                  strokeWidth="1.2"
                />
              ))}
              <circle cx={CX} cy={CY} r="32" fill="var(--color-bg)" />
            </svg>
          </div>

          <button
            type="button"
            onClick={spin}
            disabled={spinning}
            aria-label={spinning ? "Spinning" : "Spin the wheel"}
            className="absolute top-1/2 left-1/2 z-10 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-xs font-medium tracking-[0.22em] text-bg uppercase transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96] disabled:opacity-70"
          >
            {spinning ? "…" : "Spin"}
          </button>
        </div>
      </div>
    </section>
  );
}
