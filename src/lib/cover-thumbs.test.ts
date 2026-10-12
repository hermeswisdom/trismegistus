import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SOUNDCLOUD_TRACKS } from "./soundcloud-tracks.ts";
import { coverThumb } from "./cover-thumb.ts";

describe("cover thumbnails", () => {
  it("maps a cover to its thumbs/ path", () => {
    assert.equal(coverThumb("/images/tracks/same-old-score.jpg"), "/images/tracks/thumbs/same-old-score.jpg");
  });
  it("exists for every catalogue cover (run scripts/make-thumbs.py for a new track)", () => {
    for (const t of SOUNDCLOUD_TRACKS) {
      const thumb = coverThumb(t.image);
      assert.notEqual(thumb, t.image, t.id);
      const file = new URL(`../../public${thumb}`, import.meta.url);
      assert.ok(fs.existsSync(file), `${t.id}: missing ${thumb}`);
      assert.ok(fs.statSync(file).size < 60_000, `${t.id}: thumb too big`);
    }
  });
});
