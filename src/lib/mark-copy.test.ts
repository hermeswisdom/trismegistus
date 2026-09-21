import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { leftMarkCopy, markNameHint } from "./mark-copy.ts";

describe("markNameHint", () => {
  it("keeps the signed-in name private from the board", () => {
    assert.match(
      markNameHint({ signedIn: true, name: "Hermes" }),
      /Leaves as Hermes/,
    );
    assert.match(
      markNameHint({ signedIn: true, name: "Hermes" }),
      /board stays unnamed/,
    );
  });

  it("invites a name when unsigned", () => {
    assert.match(markNameHint({ signedIn: false, name: "" }), /A name for this tablet/);
  });
});

describe("leftMarkCopy", () => {
  it("confirms a private named mark", () => {
    assert.equal(
      leftMarkCopy({ signedIn: true, name: "Hermes" }),
      "Left as Hermes. The board stays unnamed.",
    );
  });

  it("confirms an unsigned mark without board copy", () => {
    assert.equal(leftMarkCopy({ signedIn: false, name: "Wanderer" }), "Left as Wanderer.");
  });
});
