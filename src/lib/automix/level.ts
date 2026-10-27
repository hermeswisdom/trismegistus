/**
 * Per-track loudness / energy levelling for Auto Mix.
 *
 * Off: every track plays at unity gain (1.0) aside from the equal-power
 * crossfade, so the mix matches the source files. Flip `APPLY_TRACK_LEVEL`
 * to true to scale each deck toward the catalogue energy target.
 */
export const APPLY_TRACK_LEVEL = false;

/** Catalogue energy the leveller aims at when enabled (0–1). */
export const TRACK_LEVEL_TARGET = 0.5;

/** Floor/ceiling so a re-enabled leveller cannot explode or mute a deck. */
const LEVEL_GAIN_MIN = 0.25;
const LEVEL_GAIN_MAX = 1;

/**
 * Gain that would match `energy` to TRACK_LEVEL_TARGET. Hot tracks come
 * down; already-quiet tracks stay at unity so a re-enabled leveller cannot
 * clip the HTMLAudio fallback.
 */
export function energyLevelGain(energy: number): number {
  const e = Math.min(1, Math.max(0.05, energy));
  const raw = TRACK_LEVEL_TARGET / e;
  return Math.min(LEVEL_GAIN_MAX, Math.max(LEVEL_GAIN_MIN, raw));
}

/** Deck peak used by the engine: 1.0 while levelling is off. */
export function trackPlaybackGain(energy: number): number {
  return APPLY_TRACK_LEVEL ? energyLevelGain(energy) : 1;
}
