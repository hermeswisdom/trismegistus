import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isRiteKey,
  landingRotation,
  pickSpinTurns,
  shouldAutoSpinOnEnter,
  WHEEL_SEGMENTS,
  WHEEL_SLICE,
} from "./wheel-rite.ts";

describe("landingRotation", () => {
  it("lands the winning slice under the top pointer", () => {
    assert.equal(landingRotation(0, 0, 5), 5 * 360);
    assert.equal(landingRotation(10, 0, 5), 6 * 360);
    assert.equal(
      landingRotation(0, 3, 5),
      5 * 360 + ((WHEEL_SEGMENTS - 3) % WHEEL_SEGMENTS) * WHEEL_SLICE,
    );
  });

  it("keeps spinning forward from an already-wound wheel", () => {
    assert.equal(landingRotation(400, 0, 5), 7 * 360);
  });
});

describe("pickSpinTurns", () => {
  it("stays in the 5–7 range", () => {
    assert.equal(pickSpinTurns(() => 0), 5);
    assert.equal(pickSpinTurns(() => 0.99), 7);
  });
});

describe("isRiteKey", () => {
  it("accepts Enter and Space on the document", () => {
    assert.equal(isRiteKey("Enter", null), true);
    assert.equal(isRiteKey(" ", undefined), true);
    assert.equal(isRiteKey("Escape", null), false);
  });

  it("ignores keys aimed at fields and buttons", () => {
    assert.equal(
      isRiteKey("Enter", { tagName: "INPUT", isContentEditable: false, closest: () => null }),
      false,
    );
    assert.equal(
      isRiteKey("Enter", { tagName: "BUTTON", isContentEditable: false, closest: () => null }),
      false,
    );
  });
});

describe("shouldAutoSpinOnEnter", () => {
  it("fires only the first time the wall is crossed", () => {
    assert.equal(shouldAutoSpinOnEnter(false), true);
    assert.equal(shouldAutoSpinOnEnter(true), false);
  });
});
