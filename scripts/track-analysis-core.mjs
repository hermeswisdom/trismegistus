/**
 * Catalogue-level maths for the mood Auto Mix analysis (scripts/analyze-tracks.mjs).
 * Pure functions only, so the rules are testable and readable in one place.
 *
 * Per-track raw features come from scripts/analyze_tracks.py; this file turns
 * them into the shipped fields: bpm (octave-corrected), Camelot code,
 * energy/brightness normalised across the catalogue, outro point, and mood.
 */

export const BPM_MIN = 70;
export const BPM_MAX = 180;
export const MOODS = /** @type {const} */ ([
  "chill",
  "hype",
  "dark",
  "happy",
  "dreamy",
  "epic",
]);

/** @param {number} x */
const clip01 = (x) => Math.min(1, Math.max(0, x));
/** @param {number} x @param {number} [d] */
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

/**
 * Fold half-time / double-time detections into 70–180 BPM.
 * @param {number} bpm
 * @returns {{ bpm: number, folded: number }} folded: ×2 per doubling, ÷2 per halving (as a factor)
 */
export function foldBpm(bpm) {
  if (!Number.isFinite(bpm) || bpm <= 0) return { bpm: 0, folded: 1 };
  let b = bpm;
  let f = 1;
  while (b < BPM_MIN) {
    b *= 2;
    f *= 2;
  }
  while (b > BPM_MAX) {
    b /= 2;
    f /= 2;
  }
  return { bpm: Math.round(b * 10) / 10, folded: f };
}

/**
 * The two tempo estimators (essentia, librosa) sometimes disagree by an
 * octave (e.g. 172 vs 86). When they do, keep the one closer to 120 BPM in
 * log terms and flag it; 3:2 disagreements are flagged but left alone.
 * @param {number} primary essentia @param {number | null | undefined} secondary librosa
 * @returns {{ bpm: number, folded: number, ambiguous: string | null }}
 */
export function resolveBpm(primary, secondary) {
  const a = foldBpm(primary);
  if (!secondary || !(secondary > 0)) return { ...a, ambiguous: null };
  const ratio = secondary / a.bpm;
  /** @param {number} r @param {number} t */
  const near = (r, t) => Math.abs(r / t - 1) < 0.04;
  if (near(ratio, 2) || near(ratio, 0.5)) {
    const alt = foldBpm(primary * a.folded * (ratio > 1 ? 2 : 0.5));
    const pick =
      Math.abs(Math.log2(alt.bpm / 120)) < Math.abs(Math.log2(a.bpm / 120))
        ? alt
        : a;
    const folded = pick === a ? a.folded : a.folded * (ratio > 1 ? 2 : 0.5);
    return { bpm: pick.bpm, folded, ambiguous: "octave" };
  }
  if (
    near(ratio, 1.5) ||
    near(ratio, 2 / 3) ||
    near(ratio, 0.75) ||
    near(ratio, 4 / 3)
  )
    return { ...a, ambiguous: "ratio" };
  return { ...a, ambiguous: null };
}

const MAJOR_CAMELOT = {
  B: 1,
  "F#": 2,
  "C#": 3,
  Ab: 4,
  Eb: 5,
  Bb: 6,
  F: 7,
  C: 8,
  G: 9,
  D: 10,
  A: 11,
  E: 12,
};
const MINOR_CAMELOT = {
  Ab: 1,
  Eb: 2,
  Bb: 3,
  F: 4,
  C: 5,
  G: 6,
  D: 7,
  A: 8,
  E: 9,
  B: 10,
  "F#": 11,
  "C#": 12,
};
const ENHARMONIC = { Db: "C#", "D#": "Eb", Gb: "F#", "G#": "Ab", "A#": "Bb" };

/** @param {string} key @param {string} mode @returns {string | null} e.g. "8A" */
export function camelot(key, mode) {
  const k = /** @type {Record<string,string>} */ (ENHARMONIC)[key] ?? key;
  const table = /** @type {Record<string, number>} */ (
    mode === "minor" ? MINOR_CAMELOT : MAJOR_CAMELOT
  );
  const n = table[k];
  return n ? `${n}${mode === "minor" ? "A" : "B"}` : null;
}

/**
 * Robust min-max: map the catalogue's 5th..95th percentile onto 0..1 (clipped).
 * @param {number[]} values
 * @returns {(x: number) => number}
 */
export function normaliser(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (v.length < 2) return () => 0.5;
  /** @param {number} p */
  const q = (p) => {
    const i = (v.length - 1) * p;
    const lo = Math.floor(i);
    return v[lo] + (v[Math.min(lo + 1, v.length - 1)] - v[lo]) * (i - lo);
  };
  const lo = q(0.05);
  const hi = q(0.95);
  return (x) => (hi > lo ? clip01((x - lo) / (hi - lo)) : 0.5);
}

/**
 * Genre hints. The catalogue has no genre field ("No genre. The lyric keeps
 * the secret."), so the hint is the override file's `genre`, else a keyword in
 * the title or slug. See moodRule for how a hint is used.
 */
export const GENRE_KEYWORDS = /** @type {const} */ ([
  ["ambient", /\b(bowl|bowls|meditation|ambient|om|singing)\b/],
  ["handpan", /\bhandpan\b/],
  ["lofi", /\b(lofi|lo-fi|kickback|chill)\b/],
  ["funk", /\b(funk|groove|bassline|bass)\b/],
  ["dance", /\b(dancefloor|rave|warehouse|techno|house|trance|pulse)\b/],
  ["trap", /\b(trap|drill)\b/],
  ["cinematic", /\b(armour|epic|anthem|kingdom|lionheart)\b/],
]);
/** @param {string} text @returns {string | null} */
export function genreFromText(text) {
  const t = text.toLowerCase().replace(/-/g, " ");
  for (const [genre, re] of GENRE_KEYWORDS) if (re.test(t)) return genre;
  return null;
}

/**
 * Percentile rank of x within values, 0..1 (mid-rank for ties).
 * @param {number[]} values @returns {(x: number) => number}
 */
export function percentileRank(values) {
  const v = values.filter(Number.isFinite);
  return (x) => {
    if (!v.length) return 0.5;
    let below = 0;
    let equal = 0;
    for (const y of v) {
      if (y < x) below++;
      else if (y === x) equal++;
    }
    return (below + 0.5 * equal) / v.length;
  };
}

export const LOW = 1 / 3;
export const HIGH = 2 / 3;
export const BORDER = 0.08;

/**
 * Primary mood from percentile ranks across the catalogue (e = energy rank,
 * b = brightness rank, both 0..1), mode, bpm and genre hint. First rule wins:
 *
 *   genre dance|trap, e ≥ 1/3          → hype
 *   genre ambient|handpan, e < 2/3     → dreamy if b ≥ 1/2, else chill
 *   genre cinematic, e ≥ 1/3           → epic
 *   e ≥ 2/3 (top third energy):        hype if b ≥ 1/2 and bpm ≥ 110, else epic
 *   e < 1/3 (bottom third):            dreamy if b ≥ 1/2, else chill
 *   middle third:                      happy if major or b ≥ 2/3;
 *                                      dark if b < 1/2;
 *                                      else epic if bpm ≥ 120, else dark
 *
 * @param {{ e: number, b: number, mode: string, bpm: number, genre?: string | null }} t
 * @returns {(typeof MOODS)[number]}
 */
export function moodRule({ e, b, mode, bpm, genre }) {
  if ((genre === "dance" || genre === "trap") && e >= LOW) return "hype";
  if ((genre === "ambient" || genre === "handpan") && e < HIGH)
    return b >= 0.5 ? "dreamy" : "chill";
  if (genre === "cinematic" && e >= LOW) return "epic";
  if (e >= HIGH) return b >= 0.5 && bpm >= 110 ? "hype" : "epic";
  if (e < LOW) return b >= 0.5 ? "dreamy" : "chill";
  if (mode === "major" || b >= HIGH) return "happy";
  if (b < 0.5) return "dark";
  return bpm >= 120 ? "epic" : "dark";
}

/**
 * Primary = moodRule. Secondary = the most common different mood among the
 * eight neighbours (energy and/or brightness rank moved ±0.08), i.e. the mood
 * a borderline track would tip into; null when it is not near a boundary.
 * @param {{ e: number, b: number, mode: string, bpm: number, genre?: string | null }} t
 */
export function pickMood(t) {
  const mood = moodRule(t);
  /** @type {Record<string, number>} */
  const votes = {};
  for (const de of [-BORDER, 0, BORDER])
    for (const db of [-BORDER, 0, BORDER]) {
      if (!de && !db) continue;
      const m = moodRule({ ...t, e: clip01(t.e + de), b: clip01(t.b + db) });
      if (m !== mood) votes[m] = (votes[m] ?? 0) + 1;
    }
  const ranked = Object.entries(votes).sort(
    (x, y) =>
      y[1] - x[1] ||
      MOODS.indexOf(/** @type {any} */ (x[0])) -
        MOODS.indexOf(/** @type {any} */ (y[0])),
  );
  return { mood, secondaryMood: ranked[0]?.[0] ?? null };
}

/**
 * Outro start for an 8–16 bar crossfade, on the bar grid. Uses 16 bars when
 * they fit in the last 25% of the audible track, else 8 bars.
 * @param {{ bpm: number, firstDownbeat: number, audioEnd: number, duration: number }} t
 */
export function outroPoint(t) {
  if (!(t.bpm > 0))
    return { outroStart: null, outroBars: null, crossfadeSeconds: null };
  const bar = (4 * 60) / t.bpm;
  const end = Math.min(t.audioEnd || t.duration, t.duration);
  const bars = 16 * bar <= 0.25 * end ? 16 : 8;
  const latest = end - bars * bar;
  const n = Math.floor((latest - t.firstDownbeat) / bar);
  const start = Math.max(t.firstDownbeat, t.firstDownbeat + n * bar);
  return {
    outroStart: round(start, 2),
    outroBars: bars,
    crossfadeSeconds: round(bars * bar, 2),
  };
}

/**
 * Build the shipped analysis for every slug from raw features, normalising
 * energy and brightness across all of them, then merge manual overrides on top.
 * Overrides of bpm/key/mode/genre/energy/brightness feed the mood rules; an
 * override of mood/secondaryMood wins outright.
 *
 * @param {Record<string, any>} raw slug → raw features (from analyze_tracks.py)
 * @param {Record<string, any>} overrides slug → partial entry
 * @param {Record<string, string>} titles slug → title
 */
export function buildAnalysis(raw, overrides = {}, titles = {}) {
  const slugs = Object.keys(raw)
    .filter((s) => !raw[s].error)
    .sort();
  const nRms = normaliser(slugs.map((s) => raw[s].rms_db));
  const nFlux = normaliser(slugs.map((s) => raw[s].spectral_flux));
  const nCent = normaliser(slugs.map((s) => raw[s].centroid_hz));
  const nRoll = normaliser(slugs.map((s) => raw[s].rolloff_hz));
  /** @type {Record<string, any>} */
  const out = {};
  for (const slug of slugs) {
    const r = raw[slug];
    const o = overrides[slug] ?? {};
    const { bpm, folded, ambiguous } = resolveBpm(r.bpm_raw, r.bpm_librosa);
    const title =
      titles[slug] ??
      slug
        .split("-")
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(" ");
    const genreHint = o.genre ?? genreFromText(`${title} ${slug}`);
    const base = {
      title,
      bpm,
      bpmFolded: folded === 1 ? null : folded,
      bpmAmbiguous: ambiguous,
      key: r.key,
      mode: r.mode,
      camelot: camelot(r.key, r.mode),
      keyStrength: r.key_strength,
      energy: round(0.6 * nRms(r.rms_db) + 0.4 * nFlux(r.spectral_flux)),
      brightness: round(0.6 * nCent(r.centroid_hz) + 0.4 * nRoll(r.rolloff_hz)),
      duration: r.duration,
      firstDownbeat: r.first_downbeat,
      genre: genreHint,
    };
    const merged = { ...base, ...o };
    if (o.key || o.mode)
      merged.camelot = o.camelot ?? camelot(merged.key, merged.mode);
    // Prefer the analyser's outro (snapped to a detected downbeat); fall back to the bar grid.
    const outro =
      r.outro_start != null &&
      !("bpm" in o) &&
      !("firstDownbeat" in o) &&
      merged.bpm === foldBpm(r.bpm_raw).bpm
        ? {
            outroStart: r.outro_start,
            outroBars: r.outro_bars,
            crossfadeSeconds: round(r.outro_bars * r.bar_seconds, 2),
          }
        : outroPoint({
            bpm: merged.bpm,
            firstDownbeat: merged.firstDownbeat,
            audioEnd: r.audio_end,
            duration: merged.duration,
          });
    out[slug] = { merged, outro, o, r };
  }
  // Mood needs every track's energy/brightness first: rank them catalogue-wide.
  const eRank = percentileRank(slugs.map((s) => out[s].merged.energy));
  const bRank = percentileRank(slugs.map((s) => out[s].merged.brightness));
  for (const slug of slugs) {
    const { merged, outro, o, r } = out[slug];
    const e = round(eRank(merged.energy));
    const b = round(bRank(merged.brightness));
    const picked = pickMood({
      e,
      b,
      mode: merged.mode,
      bpm: merged.bpm,
      genre: merged.genre,
    });
    out[slug] = {
      ...merged,
      energyPercentile: e,
      brightnessPercentile: b,
      ...outro,
      ...("outroStart" in o ? { outroStart: o.outroStart } : {}),
      mood: o.mood ?? picked.mood,
      secondaryMood:
        "secondaryMood" in o
          ? o.secondaryMood
          : o.mood
            ? null
            : picked.secondaryMood,
      overridden: Object.keys(o).length ? Object.keys(o).sort() : undefined,
      // Unnormalised measurements, kept so a --slug run can re-normalise the catalogue.
      raw: r,
    };
  }
  return out;
}
