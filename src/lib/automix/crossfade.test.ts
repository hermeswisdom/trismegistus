import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SKIP_CROSSFADE_SEC,
  barsToSeconds,
  clampMixBars,
  equalPowerCurve,
  equalPowerGains,
  mixHandoff,
  overlapSeconds,
} from "./crossfade.ts";

describe("crossfade timing", () => {
  it("is bars × 4 × 60 / bpm", () => {
    assert.equal(barsToSeconds(16, 120), 32);
    assert.equal(barsToSeconds(8, 120), 16);
    assert.equal(barsToSeconds(16, 86), (16 * 4 * 60) / 86);
    assert.equal(barsToSeconds(0, 120), 0);
  });

  it("clamps the mix to 8–16 bars and caps by remaining time", () => {
    assert.equal(clampMixBars(4), 8);
    assert.equal(clampMixBars(32), 16);
    assert.equal(clampMixBars(null), 16);
    assert.equal(overlapSeconds({ bars: 16, bpm: 120, remaining: 40 }), 32);
    assert.equal(overlapSeconds({ bars: 16, bpm: 120, remaining: 10 }), 10);
    assert.equal(overlapSeconds({ bars: 16, bpm: 120, remaining: 0 }), 0);
    assert.equal(overlapSeconds({ bars: 8, bpm: 172, remaining: 100 }), barsToSeconds(8, 172));
  });

  it("starts an auto handoff at outroStart with a remaining-time cap", () => {
    const auto = mixHandoff(
      {
        outroStart: 150.66,
        outroBars: 16,
        bpm: 86,
        duration: 196.4,
        currentTime: 12,
      },
      "auto",
    );
    assert.equal(auto.startAt, 150.66);
    const remaining = 196.4 - 150.66;
    assert.equal(auto.overlap, overlapSeconds({ bars: 16, bpm: 86, remaining }));
    assert.ok(auto.overlap <= remaining);
  });

  it("uses a 2s skip fade from now, capped by what is left", () => {
    const skip = mixHandoff(
      {
        outroStart: 150,
        outroBars: 16,
        bpm: 120,
        duration: 180,
        currentTime: 40,
      },
      "skip",
    );
    assert.equal(skip.startAt, 40);
    assert.equal(skip.overlap, SKIP_CROSSFADE_SEC);
    const late = mixHandoff(
      {
        outroStart: 150,
        outroBars: 16,
        bpm: 120,
        duration: 180,
        currentTime: 179.2,
      },
      "skip",
    );
    assert.ok(Math.abs(late.overlap - 0.8) < 1e-9);
  });
});

describe("equal-power curve", () => {
  it("crosses from outgoing-full to incoming-full at constant power", () => {
    assert.deepEqual(equalPowerGains(0), { out: 1, inn: 0 });
    const end = equalPowerGains(1);
    assert.ok(Math.abs(end.out) < 1e-12);
    assert.ok(Math.abs(end.inn - 1) < 1e-12);
    const mid = equalPowerGains(0.5);
    const half = Math.SQRT1_2;
    assert.ok(Math.abs(mid.out - half) < 1e-12);
    assert.ok(Math.abs(mid.inn - half) < 1e-12);
    const curveOut = equalPowerCurve(true, 5);
    const curveIn = equalPowerCurve(false, 5);
    assert.equal(curveOut[0], 1);
    assert.equal(curveIn[0], 0);
    assert.ok(Math.abs(curveOut[4]!) < 1e-12);
    assert.ok(Math.abs(curveIn[4]! - 1) < 1e-12);
  });
});
