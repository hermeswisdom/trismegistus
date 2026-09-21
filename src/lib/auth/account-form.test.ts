import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAccountForm } from "./account-form.ts";

describe("parseAccountForm", () => {
  it("accepts a clean sign-in", () => {
    assert.deepEqual(
      parseAccountForm({
        mode: "sign-in",
        email: " Atman@Hall.net ",
        password: "stone-door",
      }),
      { ok: true, email: "atman@hall.net", password: "stone-door", name: "" },
    );
  });

  it("requires a name on sign-up", () => {
    const result = parseAccountForm({
      mode: "sign-up",
      email: "atman@hall.net",
      password: "stone-door",
      name: "A",
    });
    assert.equal(result.ok, false);
  });

  it("rejects a short password and a bad email", () => {
    assert.equal(
      parseAccountForm({
        mode: "sign-in",
        email: "not-mail",
        password: "stone-door",
      }).ok,
      false,
    );
    assert.equal(
      parseAccountForm({
        mode: "sign-in",
        email: "atman@hall.net",
        password: "short",
      }).ok,
      false,
    );
  });
});
