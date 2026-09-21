import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PHONE_LAYOUT_MAX,
  PHONE_SCREEN_MAX,
  PHONE_VIEWPORT_BOOT,
  bootPhoneViewport,
  phoneCssSize,
  resolvePhoneViewport,
  shouldUsePhoneChrome,
  viewportContent,
} from "./viewport-lock.ts";

describe("phoneCssSize", () => {
  it("keeps a 390×844 phone as 390", () => {
    assert.deepEqual(phoneCssSize(390, 844), { width: 390, height: 844 });
  });

  it("halves a 2× CSS-pixel phone screen", () => {
    assert.deepEqual(phoneCssSize(780, 1688), { width: 390, height: 844 });
  });

  it("leaves a tablet and a desktop alone", () => {
    assert.equal(phoneCssSize(768, 1024), null);
    assert.equal(phoneCssSize(1440, 900), null);
  });
});

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

  it("keeps a numeric phone width even when layout already matches", () => {
    assert.equal(
      resolvePhoneViewport({
        screenWidth: 390,
        screenHeight: 844,
        layoutWidth: 390,
      }),
      390,
    );
  });
});

describe("bootPhoneViewport", () => {
  it("writes width=390 and a gate height for iPhone 12 Pro", () => {
    const boot = bootPhoneViewport({ screenWidth: 390, screenHeight: 844 });
    assert.equal(boot?.width, 390);
    assert.equal(boot?.height, 844);
    assert.match(boot?.content ?? "", /width=390/);
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

describe("PHONE_VIEWPORT_BOOT", () => {
  it("inlines the phone caps so the first paint does not wait for React", () => {
    assert.match(PHONE_VIEWPORT_BOOT, new RegExp(String(PHONE_SCREEN_MAX)));
    assert.match(PHONE_VIEWPORT_BOOT, new RegExp(String(PHONE_LAYOUT_MAX)));
    assert.match(PHONE_VIEWPORT_BOOT, /width="\+Math\.round\(short\)/);
    assert.match(PHONE_VIEWPORT_BOOT, /--phone-h/);
    assert.match(PHONE_VIEWPORT_BOOT, /is-phone/);
    assert.doesNotThrow(() => new Function(PHONE_VIEWPORT_BOOT));
  });
});
