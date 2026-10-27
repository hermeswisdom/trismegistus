import { type MixTrack, type Mood, type Camelot } from "./types.ts";

/** How far back endless mode refuses to repeat a slug. */
export const RECENT_WINDOW = 20;
/** Tracks handed to the engine at once in endless mode. */
export const ENDLESS_BATCH = 8;

const CAMELOT_RE = /^(\d{1,2})([AB])$/i;

export function parseCamelot(code: string | null | undefined): Camelot | null {
  if (!code) return null;
  const m = CAMELOT_RE.exec(code.trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1 || n > 12) return null;
  return { n, letter: m[2].toUpperCase() as "A" | "B" };
}

/**
 * Compatible neighbour: same code, ±1 on the wheel (12 wraps to 1) with the
 * same letter, or the relative major/minor (same number, A↔B).
 */
export function camelotCompatible(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const pa = parseCamelot(a);
  const pb = parseCamelot(b);
  if (!pa || !pb) return false;
  if (pa.n === pb.n && pa.letter === pb.letter) return true;
  if (pa.letter === pb.letter) {
    const d = Math.abs(pa.n - pb.n);
    return d === 1 || d === 11;
  }
  return pa.n === pb.n;
}

/**
 * Shortest BPM distance, treating half-time and double-time as the same tempo.
 */
export function bpmDelta(a: number, b: number): number {
  if (!(a > 0) || !(b > 0)) return Number.POSITIVE_INFINITY;
  return Math.min(Math.abs(a - b), Math.abs(a - b * 2), Math.abs(a - b / 2));
}

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = a[i]!;
    a[i] = a[j]!;
    a[j] = swap;
  }
  return a;
}

/**
 * Primary mood first, then tracks whose secondary mood matches (fill).
 * Anything else stays out of the mix.
 */
export function tracksForMood(catalog: readonly MixTrack[], mood: Mood): MixTrack[] {
  const primary: MixTrack[] = [];
  const fill: MixTrack[] = [];
  const seen = new Set<string>();
  for (const t of catalog) {
    if (t.mood === mood) {
      primary.push(t);
      seen.add(t.slug);
    }
  }
  for (const t of catalog) {
    if (t.secondaryMood === mood && !seen.has(t.slug)) fill.push(t);
  }
  return [...primary, ...fill];
}

function scoreCandidate(
  track: MixTrack,
  previous: MixTrack | null,
  energyTarget: number,
): number {
  const energyFit = 1 - Math.min(1, Math.abs(track.energy - energyTarget));
  if (!previous) return energyFit * 3;
  const harmonic = camelotCompatible(previous.camelot, track.camelot) ? 1 : 0;
  const tempo = 1 / (1 + bpmDelta(previous.bpm, track.bpm) / 8);
  return harmonic * 5 + tempo * 3 + energyFit * 2;
}

function pickBest(
  candidates: readonly MixTrack[],
  previous: MixTrack | null,
  energyTarget: number,
): number {
  let best = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < candidates.length; i += 1) {
    const score = scoreCandidate(candidates[i]!, previous, energyTarget);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/**
 * Greedy harmonic path: each next track prefers a compatible Camelot key
 * and a small BPM change (half/double counts as small), biased toward the
 * energy target. `rng` only shuffles the candidate order so equal scores
 * still vary from seed to seed.
 */
export function orderMix(
  tracks: readonly MixTrack[],
  opts: { energyTarget: number; rng: () => number },
): MixTrack[] {
  if (tracks.length <= 1) return [...tracks];
  const energyTarget = Math.min(1, Math.max(0, opts.energyTarget));
  const remaining = shuffled(tracks, opts.rng);
  const startAt = pickBest(remaining, null, energyTarget);
  const ordered: MixTrack[] = [remaining.splice(startAt, 1)[0]!];
  while (remaining.length) {
    const i = pickBest(remaining, ordered[ordered.length - 1]!, energyTarget);
    ordered.push(remaining.splice(i, 1)[0]!);
  }
  return ordered;
}

export function recentWindowSize(poolSize: number): number {
  if (poolSize <= 1) return 0;
  return Math.min(RECENT_WINDOW, poolSize - 1);
}

function withoutRecent(
  pool: readonly MixTrack[],
  recent: readonly string[],
  previousSlug?: string,
): MixTrack[] {
  const banned = new Set(recent);
  const open = pool.filter((t) => !banned.has(t.slug));
  if (open.length) return open;
  return pool.filter((t) => t.slug !== previousSlug);
}

/**
 * Next track for endless mode: same greedy rule, never repeating the recent
 * window while another track is available.
 */
export function pickNext(opts: {
  catalog: readonly MixTrack[];
  mood: Mood;
  energyTarget: number;
  previous: MixTrack;
  recent: readonly string[];
  rng: () => number;
}): MixTrack | null {
  const pool = tracksForMood(opts.catalog, opts.mood);
  if (!pool.length) return null;
  const window = recentWindowSize(pool.length);
  const recent = opts.recent.slice(-window);
  const candidates = shuffled(
    withoutRecent(pool, recent, opts.previous.slug),
    opts.rng,
  );
  if (!candidates.length) return null;
  return candidates[pickBest(candidates, opts.previous, opts.energyTarget)] ?? null;
}

export function buildMix(opts: {
  catalog: readonly MixTrack[];
  mood: Mood;
  energyTarget: number;
  seed: number;
  endless?: boolean;
  recent?: readonly string[];
  limit?: number;
}): MixTrack[] {
  const rng = mulberry32(opts.seed);
  const pool = tracksForMood(opts.catalog, opts.mood);
  const window = recentWindowSize(pool.length);
  const recent = (opts.recent ?? []).slice(-window);
  const available = withoutRecent(pool, recent);
  const ordered = orderMix(available, {
    energyTarget: opts.energyTarget,
    rng,
  });
  if (!opts.endless) return ordered;
  const limit = Math.max(1, opts.limit ?? ENDLESS_BATCH);
  return ordered.slice(0, Math.min(limit, ordered.length));
}
