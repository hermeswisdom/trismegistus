import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseLastTablet, resolveEnterIntent } from "./last-tablet.ts";

const KNOWN = new Set(["fragile-god", "the-sleepers-waking"]);

describe("parseLastTablet", () => {
  it("accepts a catalog id and drops junk", () => {
    assert.equal(parseLastTablet("fragile-god", KNOWN), "fragile-god");
    assert.equal(parseLastTablet("  the-sleepers-waking  ", KNOWN), "the-sleepers-waking");
    assert.equal(parseLastTablet("unknown", KNOWN), null);
    assert.equal(parseLastTablet("", KNOWN), null);
    assert.equal(parseLastTablet(null, KNOWN), null);
  });
});

describe("resolveEnterIntent", () => {
  it("spins the first visit when nothing else chose a tablet", () => {
    assert.equal(
      resolveEnterIntent({
        alreadyEntered: false,
        hasDeepLink: false,
        firstSpinDone: false,
        lastTrackId: null,
      }),
      "spin",
    );
  });

  it("plays a deep link even on a first visit", () => {
    assert.equal(
      resolveEnterIntent({
        alreadyEntered: false,
        hasDeepLink: true,
        firstSpinDone: false,
        lastTrackId: "fragile-god",
      }),
      "play",
    );
  });

  it("resumes the last tablet for a returning visitor", () => {
    assert.equal(
      resolveEnterIntent({
        alreadyEntered: false,
        hasDeepLink: false,
        firstSpinDone: true,
        lastTrackId: "fragile-god",
      }),
      "play",
    );
  });

  it("spins again when a returning visitor has no last tablet", () => {
    assert.equal(
      resolveEnterIntent({
        alreadyEntered: false,
        hasDeepLink: false,
        firstSpinDone: true,
        lastTrackId: null,
      }),
      "spin",
    );
  });

  it("does not spin twice in one page life", () => {
    assert.equal(
      resolveEnterIntent({
        alreadyEntered: true,
        hasDeepLink: false,
        firstSpinDone: false,
        lastTrackId: null,
      }),
      "play",
    );
  });
});
