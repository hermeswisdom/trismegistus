import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TILE_MEANING_CHARS, meaningExcerpt } from "./meaning-excerpt.ts";
import { MEANINGS } from "./meanings.ts";

describe("meaningExcerpt", () => {
  it("keeps short text whole (newlines flatten like the tile's normal white-space)", () => {
    assert.equal(meaningExcerpt("One line.\nTwo line."), "One line. Two line.");
  });
  it("cuts long text on a word boundary with an ellipsis", () => {
    const out = meaningExcerpt("alpha beta gamma delta epsilon", 17);
    assert.equal(out, "alpha beta gamma…");
  });
  it("is a prefix of every meaning and long enough to fill a 3-line tile clamp", () => {
    for (const [id, text] of Object.entries(MEANINGS)) {
      const flat = text.replace(/\s+/g, " ").trim();
      const ex = meaningExcerpt(text);
      const body = ex.endsWith("…") ? ex.slice(0, -1) : ex;
      assert.ok(flat.startsWith(body), id);
      assert.ok(ex.length <= TILE_MEANING_CHARS + 1, id);
      // ~80 chars per line at the widest tile, 3 lines.
      assert.ok(body.length >= Math.min(flat.length, 240), `${id}: ${body.length}`);
    }
  });
});
