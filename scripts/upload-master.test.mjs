import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { masterUploadPath } from "./upload-master.mjs";

describe("masterUploadPath", () => {
  it("maps a catalog slug to masters/<slug>.mp3", () => {
    assert.equal(masterUploadPath("the-sleepers-waking"), "masters/the-sleepers-waking.mp3");
    assert.equal(
      masterUploadPath("masters/the-sleepers-waking.mp3"),
      "masters/the-sleepers-waking.mp3",
    );
  });
});
