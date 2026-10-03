import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BOWLS } from "./bowls.ts";
import { planBowlVoice } from "./bowl-synth.ts";

describe("singing bowl voice plan", () => {
  it("layers inharmonic partials with a long decay for every sitting", () => {
    for (const bowl of BOWLS) {
      const plan = planBowlVoice(bowl);
      assert.ok(plan.partials.length >= 6, bowl.id);
      assert.ok(
        plan.partials.some(
          (p) => Math.abs(p.ratio - Math.round(p.ratio)) > 0.05,
        ),
        `${bowl.id} should not be a harmonic stack`,
      );
      const fundamental = plan.partials.find((p) => p.ratio === 1);
      assert.ok(fundamental && fundamental.decaySec >= 10, bowl.id);
      assert.ok(plan.strikeSec > 0 && plan.strikeHz > 0, bowl.id);
      assert.ok(plan.restrikeSec >= 7, bowl.id);
      assert.ok(plan.reverbDelays.length >= 2, bowl.id);
    }
  });

  it("builds a stereo beat only for the binaural sittings", () => {
    const schumann = planBowlVoice(BOWLS.find((b) => b.id === "schumann-783")!);
    assert.ok(schumann.binaural);
    assert.equal(schumann.binaural.leftHz, 108);
    assert.ok(
      Math.abs(schumann.binaural.rightHz - schumann.binaural.leftHz - 7.83) <
        0.01,
    );

    const sleep = planBowlVoice(BOWLS.find((b) => b.id === "deep-sleep-25")!);
    assert.ok(sleep.binaural);
    assert.ok(Math.abs(sleep.binaural.beatHz - 2.5) < 0.01);

    const focus = planBowlVoice(BOWLS.find((b) => b.id === "focus-40")!);
    assert.ok(focus.binaural);
    assert.equal(focus.binaural.beatHz, 40);

    const bowl = planBowlVoice(BOWLS.find((b) => b.id === "miracle-528")!);
    assert.equal(bowl.binaural, null);
    assert.equal(bowl.fundamental, 528);
  });
});
