import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_DEV_ORIGINS,
  PRODUCTION_ORIGINS,
  normalizeBaseURL,
  normalizeOrigin,
  parseExtraOrigins,
  resolveTrustedOrigins,
} from "./trusted-origins.ts";

describe("normalizeBaseURL / normalizeOrigin", () => {
  it("strips trailing slashes so Origin https://atmanmusic.app matches", () => {
    assert.equal(
      normalizeBaseURL("https://atmanmusic.app/"),
      "https://atmanmusic.app",
    );
    assert.equal(
      normalizeBaseURL(" https://atmanmusic.app/// "),
      "https://atmanmusic.app",
    );
    assert.equal(
      normalizeOrigin("https://atmanmusic.app/"),
      "https://atmanmusic.app",
    );
    assert.equal(normalizeBaseURL("  "), undefined);
    assert.equal(normalizeBaseURL(undefined), undefined);
  });
});

describe("parseExtraOrigins", () => {
  it("splits comma or space lists and drops junk", () => {
    assert.deepEqual(
      parseExtraOrigins(
        "https://trismegistus-three.vercel.app, not-a-url https://preview.example.test/",
      ),
      ["https://trismegistus-three.vercel.app", "https://preview.example.test"],
    );
    assert.deepEqual(parseExtraOrigins("  "), []);
    assert.deepEqual(parseExtraOrigins(undefined), []);
  });
});

describe("resolveTrustedOrigins", () => {
  it("always trusts .app, www, the smlc alias, BETTER_AUTH_URL, and localhost", () => {
    const origins = resolveTrustedOrigins({
      betterAuthUrl: "https://atmanmusic.app/",
    });
    for (const origin of PRODUCTION_ORIGINS) {
      assert.ok(origins.includes(origin), origin);
    }
    assert.ok(origins.includes("https://atmanmusic.app"));
    assert.equal(origins.includes("https://atmanmusic.app/"), false);
    assert.deepEqual(
      LOCAL_DEV_ORIGINS.every((origin) => origins.includes(origin)),
      true,
    );
    assert.equal(
      origins.filter((o) => o === "https://atmanmusic.app").length,
      1,
    );
  });

  it("still trusts .app when BETTER_AUTH_URL is a different Production host", () => {
    const origins = resolveTrustedOrigins({
      betterAuthUrl: "https://trismegistus-smlc-1397.vercel.app/",
    });
    assert.ok(origins.includes("https://atmanmusic.app"));
    assert.ok(origins.includes("https://www.atmanmusic.app"));
    assert.ok(origins.includes("https://trismegistus-smlc-1397.vercel.app"));
  });

  it("does not trust arbitrary vercel.app hosts", () => {
    const origins = resolveTrustedOrigins({
      betterAuthUrl: "https://atmanmusic.app",
    });
    assert.equal(
      origins.some((origin) => origin.includes("*.vercel.app")),
      false,
    );
    assert.equal(origins.includes("https://some-other-app.vercel.app"), false);
  });

  it("keeps preview wildcards when BETTER_AUTH_URL is unset, plus Production hosts", () => {
    const origins = resolveTrustedOrigins({
      previewHosts: ["*.grok-sandbox.com"],
    });
    assert.ok(origins.includes("*.grok-sandbox.com"));
    assert.ok(origins.includes("https://*.grok-sandbox.com"));
    assert.ok(origins.includes("https://atmanmusic.app"));
  });

  it("appends an explicit extra-origin allowlist", () => {
    const origins = resolveTrustedOrigins({
      betterAuthUrl: "https://atmanmusic.app",
      extraOrigins: "https://trismegistus-three.vercel.app/",
    });
    assert.ok(origins.includes("https://trismegistus-three.vercel.app"));
  });
});
