import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { autoFirstSpin, shouldRunFirstSpin } from "./first-spin.ts";

describe("shouldRunFirstSpin", () => {
  it("runs once for a first visit with no deep link", () => {
    assert.equal(
      shouldRunFirstSpin({ alreadyDone: false, hasDeepLink: false }),
      true,
    );
  });

  it("never reruns for a returning visitor", () => {
    assert.equal(
      shouldRunFirstSpin({ alreadyDone: true, hasDeepLink: false }),
      false,
    );
  });

  it("stands aside when a tablet is already chosen by the URL", () => {
    assert.equal(
      shouldRunFirstSpin({ alreadyDone: false, hasDeepLink: true }),
      false,
    );
  });
});

describe("autoFirstSpin", () => {
  const base = {
    entered: true,
    alreadyHandled: false,
    hasDeepLink: false,
    resumedOnEnter: false,
    spinStarted: false,
  };

  it("spins once on a plain first entry", () => {
    assert.equal(autoFirstSpin(base), "spin");
  });

  it("does not spin when Enter already resumed the last tablet", () => {
    assert.equal(autoFirstSpin({ ...base, resumedOnEnter: true }), "show-current");
  });

  it("shows the deep-linked tablet instead of spinning", () => {
    assert.equal(autoFirstSpin({ ...base, hasDeepLink: true }), "show-current");
  });

  it("adds nothing when Enter's first-visit spin already began", () => {
    assert.equal(autoFirstSpin({ ...base, spinStarted: true }), "skip");
  });

  it("waits before entry and runs only once", () => {
    assert.equal(autoFirstSpin({ ...base, entered: false }), "wait");
    assert.equal(autoFirstSpin({ ...base, alreadyHandled: true }), "wait");
  });
});
