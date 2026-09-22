import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isPwaStaticAssetPath,
  shouldBypassPwaCache,
} from "./pwa-cache.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("shouldBypassPwaCache", () => {
  const pageOrigin = "https://atmanmusic.app";

  it("leaves SoundCloud, auth, and API on the network", () => {
    assert.equal(
      shouldBypassPwaCache({
        origin: "https://w.soundcloud.com",
        pageOrigin,
        pathname: "/player/",
        hostname: "w.soundcloud.com",
        protocol: "https:",
      }),
      true,
    );
    assert.equal(
      shouldBypassPwaCache({
        origin: pageOrigin,
        pageOrigin,
        pathname: "/api/auth/get-session",
        hostname: "atmanmusic.app",
        protocol: "https:",
      }),
      true,
    );
    assert.equal(
      shouldBypassPwaCache({
        origin: pageOrigin,
        pageOrigin,
        pathname: "/auth/popup",
        hostname: "atmanmusic.app",
        protocol: "https:",
      }),
      true,
    );
  });

  it("allows same-origin static assets", () => {
    assert.equal(
      shouldBypassPwaCache({
        origin: pageOrigin,
        pageOrigin,
        pathname: "/icons/icon-192.png",
        hostname: "atmanmusic.app",
        protocol: "https:",
      }),
      false,
    );
    assert.equal(isPwaStaticAssetPath("/icons/icon-512.png"), true);
    assert.equal(isPwaStaticAssetPath("/"), false);
    assert.equal(isPwaStaticAssetPath("/login"), false);
  });
});

describe("public/sw.js", () => {
  const sw = readFileSync(join(ROOT, "public/sw.js"), "utf8");

  it("is a fetch-handling worker that never caches HTML or APIs", () => {
    assert.match(sw, /addEventListener\("fetch"/);
    assert.match(sw, /pathname\.startsWith\("\/api\/"\)/);
    assert.match(sw, /pathname\.startsWith\("\/auth\/"\)/);
    assert.match(sw, /request\.mode === "navigate"/);
    assert.match(sw, /origin !== self\.location\.origin/);
    assert.equal(sw.includes("Esoteric Vibrations"), false);
  });
});
