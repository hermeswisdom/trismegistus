import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseLoginSearch, safeLoginReturnTo } from "./login-return.ts";

describe("safeLoginReturnTo", () => {
  it("honours the allowlisted /admin return", () => {
    assert.equal(safeLoginReturnTo("/admin"), "/admin");
    assert.deepEqual(parseLoginSearch({ next: "/admin" }), { next: "/admin" });
  });
  it("rejects external, protocol-relative and unknown paths", () => {
    for (const bad of [
      "https://evil.example/admin",
      "//evil.example",
      "/\\evil.example",
      "/admin/queue",
      "/login",
      "",
      42,
      null,
      undefined,
    ]) {
      assert.equal(safeLoginReturnTo(bad), undefined, String(bad));
    }
    assert.deepEqual(parseLoginSearch({ next: "https://evil.example" }), {});
    assert.deepEqual(parseLoginSearch({}), {});
  });
});
