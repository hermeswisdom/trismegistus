import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseHomeSearch,
  tabletPagePath,
  tabletPageUrl,
} from "./tablet-link.ts";

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
});

describe("parseHomeSearch", () => {
  it("accepts daily=1 and a tablet slug", () => {
    assert.deepEqual(parseHomeSearch({ daily: "1", tablet: "fragile-god" }), {
      daily: true,
      tablet: "fragile-god",
    });
    assert.deepEqual(parseHomeSearch({ daily: "0" }), {
      daily: false,
      tablet: undefined,
    });
  });
});
