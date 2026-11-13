import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SITE_BG_NARROW_MAX_PX,
  connectionSaveData,
  isHermesPath,
  shouldMountSiteBackgroundVideo,
} from "./site-backdrop.ts";

const ROOT = join(import.meta.dirname, "..", "..");

describe("site background video gates", () => {
  it("plays only on a wide, motion-ok, non-saver desktop route", () => {
    assert.equal(
      shouldMountSiteBackgroundVideo({
        narrow: false,
        reducedMotion: false,
        saveData: false,
        posterOnlyRoute: false,
      }),
      true,
    );
  });

  it("never requests video on narrow, reduced-motion, save-data, or /hermes", () => {
    const ok = {
      narrow: false,
      reducedMotion: false,
      saveData: false,
      posterOnlyRoute: false,
    };
    assert.equal(
      shouldMountSiteBackgroundVideo({ ...ok, narrow: true }),
      false,
    );
    assert.equal(
      shouldMountSiteBackgroundVideo({ ...ok, reducedMotion: true }),
      false,
    );
    assert.equal(
      shouldMountSiteBackgroundVideo({ ...ok, saveData: true }),
      false,
    );
    assert.equal(
      shouldMountSiteBackgroundVideo({ ...ok, posterOnlyRoute: true }),
      false,
    );
    assert.equal(SITE_BG_NARROW_MAX_PX, 768);
  });

  it("treats /hermes as a poster-only route", () => {
    assert.equal(isHermesPath("/hermes"), true);
    assert.equal(isHermesPath("/hermes?x=1"), true);
    assert.equal(isHermesPath("/"), false);
    assert.equal(isHermesPath("/bowls"), false);
  });

  it("reads navigator.connection.saveData", () => {
    assert.equal(connectionSaveData({}), false);
    assert.equal(connectionSaveData({ connection: { saveData: true } }), true);
    assert.equal(
      connectionSaveData({ mozConnection: { saveData: true } }),
      true,
    );
  });
});

describe("site background wiring", () => {
  it("root mounts the backdrop; video sources stay off the server HTML path", () => {
    const root = readFileSync(join(ROOT, "src/routes/__root.tsx"), "utf8");
    const backdrop = readFileSync(
      join(ROOT, "src/components/site-backdrop.tsx"),
      "utf8",
    );
    assert.match(root, /<SiteBackdrop/);
    assert.match(backdrop, /afterLoadIdle/);
    assert.match(backdrop, /preload="none"/);
    assert.match(backdrop, /disablePictureInPicture/);
    assert.match(backdrop, /SITE_BG_WEBM/);
    assert.match(backdrop, /SITE_BG_MP4/);
    assert.match(backdrop, /SITE_BG_POSTER/);
    assert.doesNotMatch(root, /bg-loop\.(webm|mp4)/);
  });
});
