import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildWheelSegments,
  isRiteKey,
  landingRotation,
  pickSpinTurns,
  planWheelSpin,
  shouldAutoSpinOnEnter,
  sliceUnderPointer,
  sliceWedge,
  wheelPlayOn,
  wheelRiteCopy,
  wheelTransform,
  WHEEL_SEGMENTS,
  WHEEL_SLICE,
  WHEEL_SPIN_REDUCED_MS,
} from "./wheel-rite.ts";

describe("landingRotation", () => {
  it("lands the winning slice under the top pointer", () => {
    assert.equal(landingRotation(0, 0, 5), 5 * 360);
    assert.equal(landingRotation(10, 0, 5), 6 * 360);
    assert.equal(
      landingRotation(0, 3, 5),
      5 * 360 + ((WHEEL_SEGMENTS - 3) % WHEEL_SEGMENTS) * WHEEL_SLICE,
    );
    for (let index = 0; index < WHEEL_SEGMENTS; index += 1) {
      const rest = landingRotation(0, index, 5);
      assert.equal(
        sliceUnderPointer(rest),
        index,
        `winIndex ${index} must rest on its own tablet, not a seam`,
      );
    }
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

  it("stands aside for a deep-linked tablet", () => {
    assert.equal(shouldAutoSpinOnEnter(false, true), false);
  });

  it("still spins when a previous visit wrote first-spin", () => {
    assert.equal(shouldAutoSpinOnEnter(false, false), true);
  });
});

describe("wheelRiteCopy", () => {
  it("never returns empty after Enter, even with no landed tablet", () => {
    assert.equal(
      wheelRiteCopy({ entered: true, landedId: null, busy: false }),
      "turning",
    );
    assert.equal(
      wheelRiteCopy({ entered: true, landedId: null, busy: true }),
      "turning",
    );
  });

  it("keeps the landed tablet after the disc rests", () => {
    assert.equal(
      wheelRiteCopy({ entered: true, landedId: "bank-holiday-bloke", busy: false }),
      "landed",
    );
  });

  it("is empty only before the first crossing", () => {
    assert.equal(
      wheelRiteCopy({ entered: false, landedId: null, busy: false }),
      "empty",
    );
  });
});

describe("planWheelSpin", () => {
  it("always turns the disc forward onto the winning slice", () => {
    const plan = planWheelSpin(40, 3, { random: () => 0 });
    assert.ok(plan.to > plan.from);
    assert.equal(plan.turns, 5);
    assert.equal(plan.to, landingRotation(40, 3, 5));
  });

  it("keeps a visible turn when motion is reduced", () => {
    const plan = planWheelSpin(0, 0, { reduced: true });
    assert.equal(plan.turns, 1);
    assert.equal(plan.duration, WHEEL_SPIN_REDUCED_MS);
    assert.equal(plan.to, 360);
  });
});

describe("buildWheelSegments", () => {
  it("plants the winner under the drawn slice", () => {
    const winner = { id: "win" };
    const catalog = [winner, { id: "a" }, { id: "b" }, { id: "c" }];
    const next = buildWheelSegments(winner, catalog, { random: () => 0, segments: 4 });
    assert.equal(next.segments[next.winIndex]?.id, winner.id);
    assert.equal(next.segments.length, 4);
  });
});

describe("wheelTransform", () => {
  it("uses a 3d rotate so iOS composites the disc", () => {
    assert.equal(wheelTransform(90), "translate3d(0,0,0) rotate(90deg)");
  });
});

describe("sliceWedge", () => {
  it("centers tablet 0 on the pointer at rest, not on a seam", () => {
    const first = sliceWedge(0);
    assert.equal(first.center, 0);
    assert.equal(first.start, -WHEEL_SLICE / 2);
    assert.equal(first.end, WHEEL_SLICE / 2);
    assert.equal(sliceUnderPointer(0), 0);
  });

  it("keeps later tablets centered on their index angle", () => {
    const third = sliceWedge(3);
    assert.equal(third.center, 3 * WHEEL_SLICE);
    assert.equal(third.start, 3 * WHEEL_SLICE - WHEEL_SLICE / 2);
    assert.equal(sliceUnderPointer(landingRotation(0, 3, 5)), 3);
  });
});

describe("wheelPlayOn", () => {
  it("holds SoundCloud play until the disc rests", () => {
    assert.equal(wheelPlayOn("begin"), false);
    assert.equal(wheelPlayOn("land"), true);
  });
});
