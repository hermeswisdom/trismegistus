import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateMarkRate } from "./mark-rate-limit.ts";

const WINDOW = 60_000;
const MAX = 3;
const GAP = 1_000;

describe("evaluateMarkRate", () => {
  it("allows the first mark", () => {
    const decision = evaluateMarkRate(null, 10_000, {
      windowMs: WINDOW,
      max: MAX,
      minGapMs: GAP,
    });
    assert.equal(decision.allowed, true);
    assert.equal(decision.next.markCount, 1);
    assert.equal(decision.next.lastMarkAt, 10_000);
  });

  it("rejects a mark inside the gap", () => {
    const first = evaluateMarkRate(null, 10_000, {
      windowMs: WINDOW,
      max: MAX,
      minGapMs: GAP,
    });
    const again = evaluateMarkRate(first.next, 10_400, {
      windowMs: WINDOW,
      max: MAX,
      minGapMs: GAP,
    });
    assert.equal(again.allowed, false);
    assert.equal(again.reason, "gap");
    assert.deepEqual(again.next, first.next);
  });

  it("allows up to the window max, then blocks until the window expires", () => {
    let current = evaluateMarkRate(null, 0, {
      windowMs: WINDOW,
      max: MAX,
      minGapMs: GAP,
    }).next;
    current = evaluateMarkRate(current, 2_000, {
      windowMs: WINDOW,
      max: MAX,
      minGapMs: GAP,
    }).next;
    const third = evaluateMarkRate(current, 4_000, {
      windowMs: WINDOW,
      max: MAX,
      minGapMs: GAP,
    });
    assert.equal(third.allowed, true);
    assert.equal(third.next.markCount, 3);

    const blocked = evaluateMarkRate(third.next, 6_000, {
      windowMs: WINDOW,
      max: MAX,
      minGapMs: GAP,
    });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.reason, "window");

    const reset = evaluateMarkRate(third.next, WINDOW, {
      windowMs: WINDOW,
      max: MAX,
      minGapMs: GAP,
    });
    assert.equal(reset.allowed, true);
    assert.equal(reset.next.markCount, 1);
    assert.equal(reset.next.windowStart, WINDOW);
  });
});
