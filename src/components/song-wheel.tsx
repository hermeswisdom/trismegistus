import { useEffect, useRef, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import {
  readFirstSpinDone,
  shouldRunFirstSpin,
  writeFirstSpinDone,
} from "@/lib/first-spin";
import { TRACKS, getMeaning, randomTrack, type Track } from "@/lib/rooms";
import { usePlayer } from "@/lib/player-store";
import { primePlayback } from "@/lib/sc-widget";
import {
  WHEEL_SEGMENTS,
  WHEEL_SLICE,
  WHEEL_SPIN_MS,
  landingRotation,
  pickSpinTurns,
} from "@/lib/wheel-rite";
import { useWheelSpin } from "@/lib/wheel-spin";

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
  const a0 = index * WHEEL_SLICE;
  const a1 = (index + 1) * WHEEL_SLICE;
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
  const winIndex = Math.floor(Math.random() * WHEEL_SEGMENTS);
  const rest = pool.slice(0, WHEEL_SEGMENTS - 1);
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
  const entered = usePlayer((s) => s.entered);
  const nonce = useWheelSpin((s) => s.nonce);
  const requestSpin = useWheelSpin((s) => s.requestSpin);
  const search = useSearch({ from: "/" });
  const [segments, setSegments] = useState<Track[]>(() => TRACKS.slice(0, WHEEL_SEGMENTS));
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState<Track | null>(null);
  const spinRef = useRef<{ winIndex: number; winner: Track } | null>(null);
  const spinningRef = useRef(false);
  const firstSpinRef = useRef(false);
  const angleRef = useRef(0);

  useEffect(() => {
    spinningRef.current = spinning;
  }, [spinning]);

  useEffect(() => {
    angleRef.current = angle;
  }, [angle]);

  useEffect(() => {
    if (!spinning) return;
    const id = window.setTimeout(() => {
      const spin = spinRef.current;
      setSpinning(false);
      spinningRef.current = false;
      if (!spin) return;
      setLanded(spin.winner);
      play(spin.winner.id);
    }, prefersReducedMotion() ? 0 : WHEEL_SPIN_MS);
    return () => window.clearTimeout(id);
  }, [spinning, play]);

  function spin() {
    if (spinningRef.current) return;
    spinningRef.current = true;
    primePlayback();
    const winner = randomTrack(currentId);
    const next = buildSegments(winner);
    setSegments(next.segments);
    setLanded(null);
    spinRef.current = { winIndex: next.winIndex, winner };

    if (prefersReducedMotion()) {
      setAngle(((WHEEL_SEGMENTS - next.winIndex) % WHEEL_SEGMENTS) * WHEEL_SLICE);
      setSpinning(true);
      return;
    }

    const origin = angleRef.current;
    const nextAngle = landingRotation(origin, next.winIndex, pickSpinTurns());
    setAngle(Math.ceil(origin / 360) * 360);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setSpinning(true);
        setAngle(nextAngle);
      });
    });
  }

  useEffect(() => {
    if (nonce === 0) return;
    spin();
    // Intentional: each nonce is a single spin request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  useEffect(() => {
    if (!entered || firstSpinRef.current) return;
    const hasDeepLink = Boolean(search.daily || search.tablet);
    if (
      !shouldRunFirstSpin({
        alreadyDone: readFirstSpinDone(),
        hasDeepLink,
      })
    ) {
      return;
    }
    firstSpinRef.current = true;
    writeFirstSpinDone();
    if (nonce > 0) return;
    const id = window.setTimeout(() => requestSpin(), 480);
    return () => window.clearTimeout(id);
  }, [entered, nonce, requestSpin, search.daily, search.tablet]);

  const meaning = landed ? getMeaning(landed.id) : undefined;

  return (
    <section id="wheel" className="border-t border-border">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 overflow-x-clip px-5 py-16 sm:gap-12 sm:px-8 sm:py-20 lg:grid-cols-[1fr_minmax(0,22rem)] lg:py-28">
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

        <div className="relative mx-auto w-full max-w-[min(100%,calc(100vw-2.5rem),22rem)]">
          <div className="relative aspect-square w-full touch-manipulation">
            <span
              className="pointer-events-none absolute top-0 left-1/2 z-20 -translate-x-1/2 -translate-y-1 text-accent"
              aria-hidden="true"
            >
              <svg width="22" height="26" viewBox="0 0 22 26">
                <polygon points="11,26 0,0 22,0" fill="currentColor" />
              </svg>
            </span>

            <div className="size-full overflow-hidden rounded-full">
            <div
              className="pointer-events-none size-full rounded-full border border-border bg-elevated will-change-transform"
              style={{
                transform: `translateZ(0) rotate(${angle}deg)`,
                transition: spinning
                  ? `transform ${WHEEL_SPIN_MS}ms cubic-bezier(0.12, 0.7, 0.08, 1)`
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
            </div>

            <button
              type="button"
              onPointerDown={primePlayback}
              onClick={spin}
              disabled={spinning}
              aria-label={spinning ? "Spinning" : "Spin the wheel"}
              className="absolute inset-0 z-10 flex touch-manipulation items-center justify-center rounded-full bg-transparent text-bg"
            >
              <span className="flex size-20 items-center justify-center rounded-full bg-accent text-xs font-medium tracking-[0.22em] uppercase transition-[transform,opacity] duration-150 ease-out sm:size-20">
                {spinning ? "…" : "Spin"}
              </span>
            </button>
          </div>

          <button
            type="button"
            onPointerDown={primePlayback}
            onClick={spin}
            disabled={spinning}
            className="mt-5 inline-flex h-12 w-full touch-manipulation items-center justify-center bg-accent text-xs font-medium tracking-[0.2em] text-bg uppercase transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.96] disabled:opacity-70 sm:hidden"
          >
            {spinning ? "Turning" : "Spin the tablet"}
          </button>
        </div>
      </div>
    </section>
  );
}
