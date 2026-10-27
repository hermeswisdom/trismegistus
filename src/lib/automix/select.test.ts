import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type MixTrack, type Mood } from "./types.ts";
import {
  bpmDelta,
  buildMix,
  camelotCompatible,
  mulberry32,
  orderMix,
  parseCamelot,
  pickNext,
  tracksForMood,
} from "./select.ts";

function track(
  slug: string,
  extra: Partial<MixTrack> & { mood: Mood },
): MixTrack {
  return {
    slug,
    title: slug,
    bpm: 120,
    camelot: "8A",
    energy: 0.5,
    duration: 180,
    outroStart: 150,
    outroBars: 16,
    secondaryMood: null,
    ...extra,
  };
}

describe("camelot neighbours", () => {
  it("accepts same, ±1 (wrapping 12↔1), and relative major/minor", () => {
    assert.deepEqual(parseCamelot("8A"), { n: 8, letter: "A" });
    assert.equal(camelotCompatible("8A", "8A"), true);
    assert.equal(camelotCompatible("8A", "9A"), true);
    assert.equal(camelotCompatible("8A", "7A"), true);
    assert.equal(camelotCompatible("12A", "1A"), true);
    assert.equal(camelotCompatible("1B", "12B"), true);
    assert.equal(camelotCompatible("8A", "8B"), true);
    assert.equal(camelotCompatible("8A", "10A"), false);
    assert.equal(camelotCompatible("8A", "9B"), false);
    assert.equal(camelotCompatible("8A", null), false);
  });
});

describe("bpm half/double tolerance", () => {
  it("treats a doubled or halved tempo as a small change", () => {
    assert.equal(bpmDelta(86, 172), 0);
    assert.equal(bpmDelta(172, 86), 0);
    assert.ok(bpmDelta(128, 132) < 5);
    assert.ok(bpmDelta(86, 172) < bpmDelta(86, 140));
  });
});

describe("mood pool", () => {
  it("takes the primary mood then secondary-mood fill", () => {
    const catalog = [
      track("a", { mood: "hype", secondaryMood: "chill" }),
      track("b", { mood: "chill", secondaryMood: "hype" }),
      track("c", { mood: "dark", secondaryMood: "happy" }),
      track("d", { mood: "hype", secondaryMood: "epic" }),
    ];
    assert.deepEqual(
      tracksForMood(catalog, "hype").map((t) => t.slug),
      ["a", "d", "b"],
    );
    assert.deepEqual(
      tracksForMood(catalog, "dark").map((t) => t.slug),
      ["c"],
    );
  });
});

describe("greedy harmonic order", () => {
  it("prefers a compatible Camelot neighbour over a distant key", () => {
    const start = track("start", { mood: "epic", camelot: "8A", energy: 0.99 });
    const relative = track("rel", { mood: "epic", camelot: "8B", energy: 0.5 });
    const far = track("far", { mood: "epic", camelot: "3A", energy: 0.5 });
    const ordered = orderMix([start, far, relative], {
      energyTarget: 1,
      rng: () => 0,
    });
    assert.equal(ordered[0]!.slug, "start");
    assert.equal(ordered[1]!.slug, "rel");
  });

  it("prefers a half/double BPM match over a large jump at the same key", () => {
    const a = track("slow", { mood: "epic", camelot: "8A", bpm: 86, energy: 0.99 });
    const dbl = track("dbl", { mood: "epic", camelot: "8A", bpm: 172, energy: 0.5 });
    const jump = track("jump", { mood: "epic", camelot: "8A", bpm: 140, energy: 0.5 });
    const ordered = orderMix([a, jump, dbl], { energyTarget: 1, rng: () => 0 });
    assert.equal(ordered[0]!.slug, "slow");
    assert.equal(ordered[1]!.slug, "dbl");
  });

  it("biases the starting track toward the energy target", () => {
    const low = track("low", { mood: "chill", energy: 0.1 });
    const high = track("high", { mood: "chill", energy: 0.95 });
    const ordered = orderMix([low, high], { energyTarget: 1, rng: () => 0 });
    assert.equal(ordered[0]!.slug, "high");
  });

  it("is deterministic for a seed and varies across seeds", () => {
    const catalog = Array.from({ length: 8 }, (_, i) =>
      track(`t${i}`, {
        mood: "happy",
        camelot: "8A",
        bpm: 120,
        energy: 0.5,
      }),
    );
    const a = buildMix({ catalog, mood: "happy", energyTarget: 0.5, seed: 7 });
    const b = buildMix({ catalog, mood: "happy", energyTarget: 0.5, seed: 7 });
    const c = buildMix({ catalog, mood: "happy", energyTarget: 0.5, seed: 99 });
    assert.deepEqual(
      a.map((t) => t.slug),
      b.map((t) => t.slug),
    );
    assert.notDeepEqual(
      a.map((t) => t.slug),
      c.map((t) => t.slug),
    );
  });
});

describe("endless mode", () => {
  it("does not repeat recently played tracks while others remain", () => {
    const catalog = [
      track("a", { mood: "dark", camelot: "8A" }),
      track("b", { mood: "dark", camelot: "9A" }),
      track("c", { mood: "dark", camelot: "7A" }),
    ];
    const next = pickNext({
      catalog,
      mood: "dark",
      energyTarget: 0.5,
      previous: catalog[0]!,
      recent: ["a", "b"],
      rng: mulberry32(1),
    });
    assert.equal(next?.slug, "c");
  });

  it("extends a short endless batch without cloning the recent window", () => {
    const catalog = [
      track("a", { mood: "hype", energy: 0.8 }),
      track("b", { mood: "hype", energy: 0.7 }),
      track("c", { mood: "hype", energy: 0.6 }),
      track("d", { mood: "hype", energy: 0.5 }),
    ];
    const batch = buildMix({
      catalog,
      mood: "hype",
      energyTarget: 0.8,
      seed: 3,
      endless: true,
      limit: 2,
    });
    assert.equal(batch.length, 2);
    const next = pickNext({
      catalog,
      mood: "hype",
      energyTarget: 0.8,
      previous: batch[1]!,
      recent: batch.map((t) => t.slug),
      rng: mulberry32(4),
    });
    assert.ok(next);
    assert.equal(batch.some((t) => t.slug === next!.slug), false);
  });
});
