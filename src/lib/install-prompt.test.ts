import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isStandaloneDisplay,
  looksLikeIos,
  shouldOfferInstall,
} from "./install-prompt.ts";

describe("shouldOfferInstall", () => {
  it("waits for a return visit or a land", () => {
    assert.equal(
      shouldOfferInstall({
        dismissed: false,
        standalone: false,
        visitCount: 1,
        firstSpinDone: false,
        entered: false,
      }),
      false,
    );
    assert.equal(
      shouldOfferInstall({
        dismissed: false,
        standalone: false,
        visitCount: 2,
        firstSpinDone: false,
        entered: false,
      }),
      true,
    );
    assert.equal(
      shouldOfferInstall({
        dismissed: false,
        standalone: false,
        visitCount: 1,
        firstSpinDone: true,
        entered: false,
      }),
      true,
    );
    assert.equal(
      shouldOfferInstall({
        dismissed: false,
        standalone: false,
        visitCount: 1,
        firstSpinDone: false,
        entered: true,
      }),
      true,
    );
  });

  it("never nags after dismiss or when already installed", () => {
    assert.equal(
      shouldOfferInstall({
        dismissed: true,
        standalone: false,
        visitCount: 4,
        firstSpinDone: true,
        entered: true,
      }),
      false,
    );
    assert.equal(
      shouldOfferInstall({
        dismissed: false,
        standalone: true,
        visitCount: 4,
        firstSpinDone: true,
        entered: true,
      }),
      false,
    );
  });
});

describe("isStandaloneDisplay", () => {
  it("treats standalone, fullscreen, and iOS home-screen as installed", () => {
    assert.equal(isStandaloneDisplay({ displayStandalone: true }), true);
    assert.equal(isStandaloneDisplay({ displayFullscreen: true }), true);
    assert.equal(isStandaloneDisplay({ safariStandalone: true }), true);
    assert.equal(isStandaloneDisplay({}), false);
  });
});

describe("looksLikeIos", () => {
  it("detects iPhone and iPadOS-as-Mac", () => {
    assert.equal(looksLikeIos("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)"), true);
    assert.equal(looksLikeIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5), true);
    assert.equal(looksLikeIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0), false);
    assert.equal(looksLikeIos("Mozilla/5.0 (Linux; Android 14)", 5), false);
  });
});
