import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { TRACKS, getMeaning, getTrack, type Track } from "@/lib/rooms";
import { usePlayer } from "@/lib/player-store";
import { noteUserGesture } from "@/lib/sc-widget";
import {
  WHEEL_SEGMENTS,
  WHEEL_SLICE,
  buildWheelSegments,
  planWheelSpin,
  runWheelSpin,
  wheelRiteCopy,
  wheelTransform,
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

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function SongWheel() {
  const spinTablet = usePlayer((s) => s.spinTablet);
  const entered = usePlayer((s) => s.entered);
  const currentId = usePlayer((s) => s.currentId);
  const nonce = useWheelSpin((s) => s.nonce);
  const winnerId = useWheelSpin((s) => s.winnerId);
  const busy = useWheelSpin((s) => s.busy);
  const landedId = useWheelSpin((s) => s.landedId);
  const finish = useWheelSpin((s) => s.finish);
  const search = useSearch({ from: "/" });
  const [segments, setSegments] = useState<Track[]>(() => TRACKS.slice(0, WHEEL_SEGMENTS));
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState<Track | null>(null);
  const discRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const firstSpinRef = useRef(false);

  useEffect(() => {
    angleRef.current = angle;
  }, [angle]);

  useLayoutEffect(() => {
    if (!entered || firstSpinRef.current) return;
    if (search.daily || search.tablet) {
      firstSpinRef.current = true;
      const focused = getTrack(currentId);
      if (focused) setLanded(focused);
      return;
    }
    if (nonce > 0 || busy) {
      firstSpinRef.current = true;
      return;
    }
    firstSpinRef.current = true;
    spinTablet({ force: true });
  }, [entered, nonce, busy, currentId, search.daily, search.tablet, spinTablet]);

  useLayoutEffect(() => {
    if (nonce === 0 || !winnerId) return;
    const winner = getTrack(winnerId);
    if (!winner) return;
    const already = useWheelSpin.getState();
    if (already.landedId === winnerId && !already.busy) {
      setLanded(winner);
      setSpinning(false);
      return;
    }
    const next = buildWheelSegments(winner, TRACKS);
    const plan = planWheelSpin(angleRef.current, next.winIndex, {
      reduced: prefersReducedMotion(),
    });
    setSegments(next.segments);
    setSpinning(true);

    let cancelled = false;
    let runner: { cancel: () => void } = { cancel() {} };

    const land = () => {
      if (cancelled) return;
      cancelled = true;
      angleRef.current = plan.to;
      setAngle(plan.to);
      setSpinning(false);
      setLanded(winner);
      finish(winner.id);
    };

    const start = () => {
      if (cancelled) return;
      const el = discRef.current;
      const run = el
        ? runWheelSpin(el, plan)
        : {
            done: new Promise<void>((resolve) => {
              window.setTimeout(resolve, plan.duration);
            }),
            cancel() {},
          };
      runner = run;
      void run.done.then(land);
    };

    start();
    const watchdog = window.setTimeout(land, Math.max(0, plan.duration) + 400);

    return () => {
      cancelled = true;
      runner.cancel();
      window.clearTimeout(watchdog);
    };
  }, [nonce, winnerId, finish]);

  function onSpin() {
    noteUserGesture();
    spinTablet();
  }

  const sealedLanded = landed ?? (landedId ? getTrack(landedId) : null);
  const rite = wheelRiteCopy({
    entered,
    landedId: sealedLanded?.id ?? null,
    busy: spinning || busy,
  });

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
          {rite === "landed" && sealedLanded ? (
            <p
              className="mt-8 font-display text-2xl italic text-fg"
              data-wheel-landed={sealedLanded.id}
            >
              {sealedLanded.title}
              <span className="mt-2 block line-clamp-4 whitespace-pre-line text-sm font-sans font-light tracking-normal text-muted not-italic normal-case">
                {getMeaning(sealedLanded.id)}
              </span>
            </p>
          ) : rite === "turning" ? (
            <p className="mt-8 text-sm text-subtle" data-wheel-turning="">
              The wheel is turning.
            </p>
          ) : (
            <p className="mt-8 text-sm text-subtle">
              No tablet yet.
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

            <div className="wheel-frame size-full overflow-hidden rounded-full">
              <div
                ref={discRef}
                data-wheel-disc=""
                data-wheel-spinning={spinning ? "true" : "false"}
                className="wheel-disc pointer-events-none size-full rounded-full border border-border bg-elevated"
                style={{ transform: wheelTransform(angle) }}
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
              onPointerDown={noteUserGesture}
              onClick={onSpin}
              disabled={spinning || busy}
              aria-label={spinning || busy ? "Spinning" : "Spin the wheel"}
              className="absolute inset-0 z-10 flex touch-manipulation items-center justify-center rounded-full bg-[rgba(0,0,0,0.001)] text-bg"
            >
              <span className="flex size-24 items-center justify-center rounded-full bg-accent text-xs font-medium tracking-[0.22em] uppercase transition-[transform,opacity] duration-150 ease-out sm:size-20">
                {spinning || busy ? "…" : "Spin"}
              </span>
            </button>
          </div>

          <button
            type="button"
            onPointerDown={noteUserGesture}
            onClick={onSpin}
            disabled={spinning || busy}
            className="mt-5 inline-flex h-12 w-full touch-manipulation items-center justify-center bg-accent text-xs font-medium tracking-[0.2em] text-bg uppercase transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.96] disabled:opacity-70 sm:hidden"
          >
            {spinning || busy ? "Turning" : "Spin the tablet"}
          </button>
        </div>
      </div>
    </section>
  );
}
