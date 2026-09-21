import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolvePhoneViewport,
  shouldUsePhoneChrome,
  viewportContent,
} from "./viewport-lock.ts";

describe("resolvePhoneViewport", () => {
  it("forces device width when a phone screen is laid out at 2x", () => {
    assert.equal(
      resolvePhoneViewport({
        screenWidth: 390,
        screenHeight: 844,
        layoutWidth: 780,
      }),
      390,
    );
  });

  it("leaves a true desktop viewport alone", () => {
    assert.equal(
      resolvePhoneViewport({
        screenWidth: 1440,
        screenHeight: 900,
        layoutWidth: 1440,
      }),
      null,
    );
  });

  it("no-ops when layout already matches the phone", () => {
    assert.equal(
      resolvePhoneViewport({
        screenWidth: 390,
        screenHeight: 844,
        layoutWidth: 390,
      }),
      null,
    );
  });
});

describe("shouldUsePhoneChrome", () => {
  it("treats a 780px layout as a phone wall", () => {
    assert.equal(
      shouldUsePhoneChrome({
        layoutWidth: 780,
        screenWidth: 390,
        screenHeight: 844,
        coarsePointer: true,
      }),
      true,
    );
  });

  it("keeps desktop chrome on a wide fine pointer", () => {
    assert.equal(
      shouldUsePhoneChrome({
        layoutWidth: 1280,
        screenWidth: 1280,
        screenHeight: 800,
        coarsePointer: false,
      }),
      false,
    );
  });
});

describe("viewportContent", () => {
  it("writes a forced width and the default device-width string", () => {
    assert.match(viewportContent(390), /width=390/);
    assert.match(viewportContent(), /width=device-width/);
    assert.match(viewportContent(), /viewport-fit=cover/);
  });
});
