import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { selectRoomPulse } from "./play-board.ts";

describe("selectRoomPulse", () => {
  it("puts a private named mark first without exposing the name", () => {
    const pulse = selectRoomPulse({
      namedMarks: [
        { trackId: "fragile-god", createdAt: "2026-09-21", mine: true },
      ],
      recent: [{ trackId: "the-sleepers-waking", createdAt: "2026-09-20" }],
    });
    assert.equal(pulse[0]?.mine, true);
    assert.equal(pulse[0]?.trackId, "fragile-god");
    assert.equal(pulse[1]?.trackId, "the-sleepers-waking");
  });
});
