import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { atmanGlow } from "./atman-glow.ts";

describe("atmanGlow", () => {
  it("idles at rest so CSS can breathe the lockup", () => {
    const glow = atmanGlow({
      playing: false,
      playPending: false,
      hasWave: false,
      sample: 0,
      nowMs: 0,
    });
    assert.equal(glow.mode, "idle");
    assert.equal(glow.level, 0);
  });

  it("pulses while sounding even with no waveform", () => {
    const a = atmanGlow({
      playing: true,
      playPending: true,
      hasWave: false,
      sample: 0,
      nowMs: 0,
    });
    const b = atmanGlow({
      playing: true,
      playPending: true,
      hasWave: false,
      sample: 0,
      nowMs: 2140,
    });
    assert.equal(a.mode, "sounding");
    assert.equal(b.mode, "sounding");
    assert.notEqual(Number(a.level.toFixed(3)), Number(b.level.toFixed(3)));
    assert.ok(a.level > 0.3 && a.level < 1);
  });

  it("keeps live glow moving when the playhead is stuck", () => {
    const a = atmanGlow({
      playing: true,
      playPending: false,
      hasWave: true,
      sample: 0.2,
      nowMs: 400,
    });
    const b = atmanGlow({
      playing: true,
      playPending: false,
      hasWave: true,
      sample: 0.2,
      nowMs: 1800,
    });
    assert.equal(a.mode, "live");
    assert.notEqual(Number(a.level.toFixed(3)), Number(b.level.toFixed(3)));
  });

  it("holds a still lamp when motion is reduced", () => {
    const glow = atmanGlow({
      playing: true,
      playPending: false,
      hasWave: true,
      sample: 0.9,
      nowMs: 1200,
      reduceMotion: true,
    });
    assert.equal(glow.mode, "live");
    assert.equal(glow.level, 0.42);
  });
});
