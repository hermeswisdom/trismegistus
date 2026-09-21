import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { savedTablets } from "./saved-tablets.ts";

describe("savedTablets", () => {
  const tracks = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("keeps wall order for hearted ids", () => {
    assert.deepEqual(savedTablets(tracks, { c: true, a: true }), [
      { id: "a" },
      { id: "c" },
    ]);
  });

  it("is empty when nothing is hearted", () => {
    assert.deepEqual(savedTablets(tracks, {}), []);
  });
});
