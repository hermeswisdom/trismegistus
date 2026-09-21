import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  heartMapFromIds,
  idsFromHeartMap,
  isSignedInForSaves,
  mergeFavoriteIds,
} from "./favorites-sync.ts";

describe("mergeFavoriteIds", () => {
  it("unions local and remote catalog ids", () => {
    const known = new Set(["fragile-god", "the-sleepers-waking"]);
    assert.deepEqual(
      mergeFavoriteIds(
        ["fragile-god", "nope"],
        ["the-sleepers-waking", "fragile-god"],
        known,
      ),
      ["the-sleepers-waking", "fragile-god"],
    );
  });
});

describe("heart map", () => {
  it("round-trips known ids", () => {
    const map = heartMapFromIds(["fragile-god", "  "]);
    assert.deepEqual(map, { "fragile-god": true });
    assert.deepEqual(idsFromHeartMap(map), ["fragile-god"]);
  });
});

describe("isSignedInForSaves", () => {
  it("requires live auth and a real user", () => {
    assert.equal(
      isSignedInForSaves({ authEnabled: false, userId: "dev-user", isDevFallback: true }),
      false,
    );
    assert.equal(
      isSignedInForSaves({ authEnabled: true, userId: null, isDevFallback: false }),
      false,
    );
    assert.equal(
      isSignedInForSaves({
        authEnabled: true,
        userId: "user-1",
        isDevFallback: false,
      }),
      true,
    );
  });
});
