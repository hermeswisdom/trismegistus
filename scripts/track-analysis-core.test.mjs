import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAnalysis,
  camelot,
  foldBpm,
  genreFromText,
  moodRule,
  normaliser,
  outroPoint,
  percentileRank,
  pickMood,
  resolveBpm,
} from "./track-analysis-core.mjs";

test("foldBpm pulls half/double time into 70–180", () => {
  assert.deepEqual(foldBpm(62), { bpm: 124, folded: 2 });
  assert.deepEqual(foldBpm(190.04), { bpm: 95, folded: 0.5 });
  assert.deepEqual(foldBpm(128.04), { bpm: 128, folded: 1 });
});

test("camelot wheel", () => {
  assert.equal(camelot("A", "minor"), "8A");
  assert.equal(camelot("C", "major"), "8B");
  assert.equal(camelot("F#", "minor"), "11A");
  assert.equal(camelot("Db", "major"), "3B");
  assert.equal(camelot("X", "major"), null);
});

test("normaliser clips to the 5–95th percentile", () => {
  const n = normaliser(Array.from({ length: 101 }, (_, i) => i));
  assert.equal(n(5), 0);
  assert.equal(n(95), 1);
  assert.equal(n(50), 0.5);
  assert.equal(n(-10), 0);
});

test("resolveBpm picks the octave nearer 120 when estimators disagree", () => {
  assert.deepEqual(resolveBpm(172.27, 86.13), {
    bpm: 86.1,
    folded: 0.5,
    ambiguous: "octave",
  });
  assert.deepEqual(resolveBpm(83.48, 166.71), {
    bpm: 167,
    folded: 2,
    ambiguous: "octave",
  });
  assert.deepEqual(resolveBpm(128, 129.2), {
    bpm: 128,
    folded: 1,
    ambiguous: null,
  });
  assert.equal(resolveBpm(172.27, 117.45).ambiguous, "ratio");
});

test("percentile mood rules", () => {
  const r = percentileRank([1, 2, 3, 4]);
  assert.equal(r(1), 0.125);
  assert.equal(r(4), 0.875);
  /** @param {number} e @param {number} b @param {string} [mode] @param {number} [bpm] @param {string | null} [genre] */
  const m = (e, b, mode = "minor", bpm = 125, genre = null) =>
    moodRule({ e, b, mode, bpm, genre });
  assert.equal(m(0.9, 0.8), "hype");
  assert.equal(m(0.9, 0.2), "epic");
  assert.equal(m(0.9, 0.8, "minor", 95), "epic");
  assert.equal(m(0.1, 0.8), "dreamy");
  assert.equal(m(0.1, 0.2), "chill");
  assert.equal(m(0.5, 0.8), "happy");
  assert.equal(m(0.5, 0.4, "major"), "happy");
  assert.equal(m(0.5, 0.2), "dark");
  assert.equal(m(0.5, 0.6, "minor", 100), "dark");
  assert.equal(m(0.5, 0.6, "minor", 128), "epic");
  assert.equal(m(0.5, 0.1, "minor", 125, "dance"), "hype");
  assert.equal(m(0.5, 0.6, "minor", 125, "ambient"), "dreamy");
  assert.deepEqual(pickMood({ e: 0.7, b: 0.8, mode: "minor", bpm: 128 }), {
    mood: "hype",
    secondaryMood: "happy",
  });
  assert.deepEqual(pickMood({ e: 0.95, b: 0.95, mode: "minor", bpm: 128 }), {
    mood: "hype",
    secondaryMood: null,
  });
  assert.equal(genreFromText("Moonlit Handpan Groove"), "handpan");
});

test("outro sits on the bar grid and leaves 8–16 bars", () => {
  const o = outroPoint({
    bpm: 120,
    firstDownbeat: 0.5,
    audioEnd: 240,
    duration: 241,
  });
  assert.equal(o.outroBars, 16);
  assert.equal(o.crossfadeSeconds, 32);
  assert.ok(
    o.outroStart !== null &&
      o.outroStart <= 240 - 32 &&
      o.outroStart > 240 - 34,
  );
  assert.equal((((o.outroStart ?? 0) - 0.5) / 2) % 1, 0);
  assert.equal(
    outroPoint({ bpm: 120, firstDownbeat: 0, audioEnd: 100, duration: 100 })
      .outroBars,
    8,
  );
});

test("overrides merge on top and feed the mood", () => {
  const raw = {
    a: {
      bpm_raw: 60,
      key: "A",
      mode: "minor",
      rms_db: -10,
      spectral_flux: 2,
      centroid_hz: 3000,
      rolloff_hz: 6000,
      duration: 200,
      first_downbeat: 0.2,
      audio_end: 199,
    },
    b: {
      bpm_raw: 128,
      key: "C",
      mode: "major",
      rms_db: -20,
      spectral_flux: 1,
      centroid_hz: 1500,
      rolloff_hz: 3000,
      duration: 200,
      first_downbeat: 0.1,
      audio_end: 199,
    },
  };
  const out = buildAnalysis(
    raw,
    { b: { mood: "epic", genre: "cinematic" } },
    { a: "Track A" },
  );
  assert.equal(out.a.bpm, 120);
  assert.equal(out.a.bpmFolded, 2);
  assert.equal(out.a.camelot, "8A");
  assert.equal(out.a.title, "Track A");
  assert.equal(out.b.title, "B");
  assert.equal(out.b.mood, "epic");
  assert.equal(out.b.secondaryMood, null);
  assert.deepEqual(out.b.overridden, ["genre", "mood"]);
});
