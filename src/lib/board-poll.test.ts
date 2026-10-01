import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BOARD_PULSE_MS, shouldPollBoard } from "./board-poll.ts";

describe("shouldPollBoard", () => {
  it("never polls a hidden tab", () => {
    assert.equal(shouldPollBoard({ hidden: true, lastPollAt: null, now: 1e6 }), false);
    assert.equal(shouldPollBoard({ hidden: true, lastPollAt: 0, now: 1e9 }), false);
  });
  it("polls a visible tab with no previous poll", () => {
    assert.equal(shouldPollBoard({ hidden: false, lastPollAt: null, now: 0 }), true);
  });
  it("on return to visible, polls only when the last poll is 45s+ old", () => {
    assert.equal(BOARD_PULSE_MS, 45_000);
    assert.equal(shouldPollBoard({ hidden: false, lastPollAt: 0, now: 44_999 }), false);
    assert.equal(shouldPollBoard({ hidden: false, lastPollAt: 0, now: 45_000 }), true);
    assert.equal(shouldPollBoard({ hidden: false, lastPollAt: 0, now: 600_000 }), true);
  });
});
