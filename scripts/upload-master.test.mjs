import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { catalogSnippet, masterBlobPath, silentMasterMp3 } from "./upload-master.mjs";

describe("upload-master", () => {
  it("maps slug → masters/<slug>.mp3", () => {
    assert.equal(masterBlobPath("the-sleepers-waking"), "masters/the-sleepers-waking.mp3");
    assert.throws(() => masterBlobPath("../etc/passwd"));
  });

  it("prints the catalog downloadKey snippet", () => {
    assert.equal(
      catalogSnippet("fragile-god"),
      `    downloadKey: "masters/fragile-god.mp3",`,
    );
  });

  it("builds a silent fixture that is not a SoundCloud rip", () => {
    const bytes = silentMasterMp3();
    assert.ok(bytes.length > 20);
    assert.equal(bytes.subarray(0, 3).toString(), "ID3");
  });
});
