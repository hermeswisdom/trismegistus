import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useWheelSpin } from "./wheel-spin.ts";

describe("useWheelSpin", () => {
  beforeEach(() => {
    useWheelSpin.setState({ nonce: 0, winnerId: null, landedId: null, busy: false });
  });

  it("records the winner on begin and refuses a second spin while busy", () => {
    assert.equal(useWheelSpin.getState().begin("alpha"), true);
    assert.equal(useWheelSpin.getState().winnerId, "alpha");
    assert.equal(useWheelSpin.getState().busy, true);
    assert.equal(useWheelSpin.getState().begin("beta"), false);
    assert.equal(useWheelSpin.getState().winnerId, "alpha");
    useWheelSpin.getState().finish();
    assert.equal(useWheelSpin.getState().busy, false);
    assert.equal(useWheelSpin.getState().landedId, "alpha");
    assert.equal(useWheelSpin.getState().begin("beta"), true);
    assert.equal(useWheelSpin.getState().winnerId, "beta");
  });

  it("force-begins over a stuck busy lock", () => {
    assert.equal(useWheelSpin.getState().begin("alpha"), true);
    assert.equal(useWheelSpin.getState().begin("beta", { force: true }), true);
    assert.equal(useWheelSpin.getState().winnerId, "beta");
    assert.equal(useWheelSpin.getState().nonce, 2);
  });
});
