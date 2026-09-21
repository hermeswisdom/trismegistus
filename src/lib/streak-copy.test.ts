import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { riteNumeral, wallStreakCopy } from "./streak-copy.ts";

describe("riteNumeral", () => {
  it("uses roman glyphs then falls back to decimal", () => {
    assert.equal(riteNumeral(0), "");
    assert.equal(riteNumeral(1), "I");
    assert.equal(riteNumeral(3), "III");
    assert.equal(riteNumeral(13), "13");
  });
});

describe("wallStreakCopy", () => {
  it("invites the first listen", () => {
    assert.deepEqual(wallStreakCopy({ count: 0, todayMarked: false }), {
      kicker: "The rite",
      detail: "Listen thirty seconds. Come back tomorrow.",
    });
  });

  it("asks them to return once today is written", () => {
    const copy = wallStreakCopy({ count: 3, todayMarked: true });
    assert.equal(copy.kicker, "Rite · III");
    assert.match(copy.detail, /Come back tomorrow/);
    assert.match(copy.detail, /3 days at the wall/);
  });

  it("asks them to keep an open streak", () => {
    const copy = wallStreakCopy({ count: 2, todayMarked: false });
    assert.equal(copy.kicker, "Rite · II");
    assert.match(copy.detail, /keep the days/);
  });
});
