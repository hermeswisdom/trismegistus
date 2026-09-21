import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldRunFirstSpin } from "./first-spin.ts";

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
