import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APPLY_TRACK_LEVEL,
  TRACK_LEVEL_TARGET,
  energyLevelGain,
  trackPlaybackGain,
} from "./level.ts";

describe("Auto Mix track level", () => {
  it("is off, so every track plays at unity gain", () => {
    assert.equal(APPLY_TRACK_LEVEL, false);
    for (const energy of [0, 0.1, 0.5, 0.95, 1]) {
      assert.equal(trackPlaybackGain(energy), 1);
    }
  });

  it("keeps a re-enableable leveller that caps hot energy toward the target", () => {
    assert.equal(energyLevelGain(TRACK_LEVEL_TARGET), 1);
    assert.equal(energyLevelGain(1), TRACK_LEVEL_TARGET);
    assert.ok(energyLevelGain(0.8) < energyLevelGain(0.6));
    assert.equal(energyLevelGain(0.1), 1);
    assert.ok(energyLevelGain(0) >= 0.25);
    assert.ok(energyLevelGain(0) <= 1);
  });
});
