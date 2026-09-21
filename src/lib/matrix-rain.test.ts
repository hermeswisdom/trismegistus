import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rainBudget, rainColumnFinished, rainSpawnY } from "./matrix-rain.ts";

describe("rainBudget", () => {
  it("caps phone columns and drops blur so the wall stays readable", () => {
    const phone = rainBudget({
      width: 390,
      height: 844,
      compact: false,
      viewportWidth: 390,
    });
    assert.ok(phone.columns <= 9);
    assert.equal(phone.shadowBlur, 0);
    assert.equal(phone.simpleGlyphs, true);
    assert.ok(phone.trail <= 8);
    assert.ok(phone.frameMs >= 40);
  });

  it("lets the desktop lockup carry a denser veil", () => {
    const desk = rainBudget({
      width: 1100,
      height: 280,
      compact: false,
      viewportWidth: 1280,
      playing: true,
    });
    assert.ok(desk.columns > 12);
    assert.ok(desk.shadowBlur >= 8);
    assert.equal(desk.simpleGlyphs, false);
  });

  it("keeps mark-size rain tiny", () => {
    const mark = rainBudget({
      width: 16,
      height: 24,
      compact: true,
      viewportWidth: 390,
    });
    assert.ok(mark.columns <= 5);
    assert.equal(mark.simpleGlyphs, true);
  });
});

describe("rain spawn", () => {
  it("starts columns above the clip so notes do not flood the first frame", () => {
    const y = rainSpawnY(800, false);
    assert.ok(y <= 0);
  });

  it("recycles a column only after the trail has left the clip", () => {
    assert.equal(rainColumnFinished(400, 8, 20, 200), true);
    assert.equal(rainColumnFinished(80, 8, 20, 200), false);
  });
});
