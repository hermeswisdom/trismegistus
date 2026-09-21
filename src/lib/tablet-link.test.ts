import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SITE_ORIGIN,
  parseHomeSearch,
  tabletPagePath,
  tabletPageUrl,
} from "./tablet-link.ts";

describe("SITE_ORIGIN", () => {
  it("is the live Production alias, not the retired three tip", () => {
    assert.equal(SITE_ORIGIN, "https://trismegistus-smlc-1397.vercel.app");
    assert.equal(SITE_ORIGIN.includes("trismegistus-three"), false);
  });
});

describe("tabletPagePath", () => {
  it("builds daily and tablet deep links", () => {
    assert.equal(tabletPagePath({ daily: true }), "/?daily=1");
    assert.equal(tabletPagePath({ tablet: "fragile-god" }), "/?tablet=fragile-god");
    assert.equal(tabletPagePath({}), "/");
  });
});

describe("tabletPageUrl", () => {
  it("joins an origin without a trailing slash", () => {
    assert.equal(
      tabletPageUrl({ daily: true, origin: "https://example.test/" }),
      "https://example.test/?daily=1",
    );
  });

  it("defaults OG / share URLs to the live Production alias", () => {
    assert.equal(
      tabletPageUrl({ tablet: "fragile-god" }),
      "https://trismegistus-smlc-1397.vercel.app/?tablet=fragile-god",
    );
    assert.equal(tabletPageUrl({}), "https://trismegistus-smlc-1397.vercel.app/");
  });
});

describe("parseHomeSearch", () => {
  it("accepts daily=1 and a tablet slug", () => {
    assert.deepEqual(parseHomeSearch({ daily: "1", tablet: "fragile-god" }), {
      daily: 1,
      tablet: "fragile-god",
    });
    assert.deepEqual(parseHomeSearch({ daily: true }), { daily: 1 });
    assert.deepEqual(parseHomeSearch({ daily: "0" }), {});
    assert.deepEqual(parseHomeSearch({}), {});
  });
});
