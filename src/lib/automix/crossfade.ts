import { type MixTrack } from "./types.ts";

export const SKIP_CROSSFADE_SEC = 2;
export const MIN_BARS = 8;
export const MAX_BARS = 16;

/** `bars * 4 * 60 / bpm` — the length of that many bars at this tempo. */
export function barsToSeconds(bars: number, bpm: number): number {
  if (!(bars > 0) || !(bpm > 0)) return 0;
  return (bars * 4 * 60) / bpm;
}

export function clampMixBars(bars: number | null | undefined): number {
  if (bars == null || !Number.isFinite(bars)) return MAX_BARS;
  return Math.min(MAX_BARS, Math.max(MIN_BARS, Math.round(bars)));
}

/**
 * Crossfade overlap: 8–16 bars at the current BPM, never longer than the
 * time actually left on the outgoing track.
 */
export function overlapSeconds(opts: {
  bars: number | null | undefined;
  bpm: number;
  remaining: number;
}): number {
  const fromBpm = barsToSeconds(clampMixBars(opts.bars), opts.bpm);
  return Math.max(0, Math.min(fromBpm, Math.max(0, opts.remaining)));
}

/**
 * Equal-power fade. `t` is 0 at the start of the crossfade (outgoing full)
 * and 1 at the end (incoming full).
 */
export function equalPowerGains(t: number): { out: number; inn: number } {
  const x = Math.min(1, Math.max(0, t));
  const angle = x * (Math.PI / 2);
  return { out: Math.cos(angle), inn: Math.sin(angle) };
}

export function equalPowerCurve(outgoing: boolean, samples = 65): Float32Array {
  const n = Math.max(2, samples);
  const arr = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const { out, inn } = equalPowerGains(i / (n - 1));
    arr[i] = outgoing ? out : inn;
  }
  return arr;
}

export type MixHandoff = {
  /** Current-track time when the next deck should start. */
  startAt: number;
  overlap: number;
};

/**
 * When to start the incoming deck, and how long the equal-power overlap
 * lasts. Auto handoffs begin at `outroStart`; a skip is a 2 s fade from now.
 */
export function mixHandoff(
  current: Pick<MixTrack, "outroStart" | "outroBars" | "bpm" | "duration"> & {
    currentTime: number;
  },
  kind: "auto" | "skip",
): MixHandoff {
  const duration = Math.max(0, current.duration);
  const now = Math.min(duration, Math.max(0, current.currentTime));
  const remainingNow = Math.max(0, duration - now);
  if (kind === "skip") {
    return {
      startAt: now,
      overlap: Math.min(SKIP_CROSSFADE_SEC, remainingNow),
    };
  }
  const startAt =
    current.outroStart != null && Number.isFinite(current.outroStart)
      ? Math.min(duration, Math.max(0, current.outroStart))
      : Math.max(0, duration - overlapSeconds({ bars: current.outroBars, bpm: current.bpm, remaining: remainingNow }));
  const remaining = Math.max(0, duration - startAt);
  return {
    startAt,
    overlap: overlapSeconds({
      bars: current.outroBars,
      bpm: current.bpm,
      remaining,
    }),
  };
}
