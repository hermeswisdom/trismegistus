import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { markAuthorFromSession } from "./mark-name.ts";

describe("markAuthorFromSession", () => {
  it("prefers the private display name", () => {
    assert.equal(
      markAuthorFromSession({ name: "  Hermes  ", email: "h@example.com" }),
      "Hermes",
    );
  });

  it("falls back to the email local-part, then the typed name", () => {
    assert.equal(
      markAuthorFromSession({ name: "", email: "listener@example.com" }),
      "listener",
    );
    assert.equal(markAuthorFromSession(null, "Wanderer"), "Wanderer");
    assert.equal(markAuthorFromSession(null, ""), "");
  });
});
