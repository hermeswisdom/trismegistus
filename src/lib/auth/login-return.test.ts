import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  loginPathWithReturn,
  oauthCallbackPath,
  parseLoginSearch,
  safeLoginReturnTo,
} from "./login-return.ts";

describe("safeLoginReturnTo", () => {
  it("honours the /admin return used by the admin gate", () => {
    assert.equal(safeLoginReturnTo("/admin"), "/admin");
    assert.deepEqual(parseLoginSearch({ next: "/admin" }), { next: "/admin" });
  });

  it("honours any same-origin path, keeping query and hash", () => {
    assert.equal(safeLoginReturnTo("/"), "/");
    assert.equal(safeLoginReturnTo("/admin/"), "/admin/");
    assert.equal(safeLoginReturnTo("/admin/queue"), "/admin/queue");
    assert.equal(safeLoginReturnTo("/admin?tab=waiting"), "/admin?tab=waiting");
    assert.equal(safeLoginReturnTo("/admin#top"), "/admin");
    assert.equal(safeLoginReturnTo("/t/some-track"), "/t/some-track");
  });

  it("rejects external, protocol-relative, smuggled and looping values", () => {
    for (const bad of [
      "https://evil.example/admin",
      "http://evil.example",
      "javascript:alert(1)",
      "//evil.example",
      "//evil.example/admin",
      "/\\evil.example",
      "\\\\evil.example",
      "/..//evil.example",
      "/.//evil.example",
      "/admin/..//evil.example",
      "/%2e%2e//evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      " /admin",
      "admin",
      "/login",
      "/login?next=%2Fadmin",
      "",
      42,
      null,
      undefined,
      ["/admin"],
    ]) {
      assert.equal(safeLoginReturnTo(bad), undefined, JSON.stringify(bad));
    }
    assert.deepEqual(parseLoginSearch({ next: "https://evil.example" }), {});
    assert.deepEqual(parseLoginSearch({ next: "//evil.example" }), {});
    assert.deepEqual(parseLoginSearch({}), {});
  });
});

describe("loginPathWithReturn", () => {
  it("keeps a safe return path on the sign-in URL", () => {
    assert.equal(loginPathWithReturn("/admin"), "/login?next=%2Fadmin");
    assert.equal(loginPathWithReturn("/admin?tab=a"), "/login?next=%2Fadmin%3Ftab%3Da");
  });
  it("drops an unsafe or missing return path", () => {
    assert.equal(loginPathWithReturn(undefined), "/login");
    assert.equal(loginPathWithReturn("//evil.example"), "/login");
    for (const bad of [
      "/..//evil.example",
      "/.//evil.example",
      "/admin/..//evil.example",
      "/%2e%2e//evil.example",
    ]) {
      assert.equal(loginPathWithReturn(bad), "/login", bad);
    }
  });
});

describe("oauthCallbackPath", () => {
  it("passes a safe path through for Better Auth's callbackURL", () => {
    assert.equal(oauthCallbackPath("/admin"), "/admin");
    assert.equal(oauthCallbackPath("/admin?tab=waiting"), "/admin?tab=waiting");
  });
  it("falls back to the bare path, then the wall", () => {
    assert.equal(oauthCallbackPath("/admin?q=a,b"), "/admin");
    assert.equal(oauthCallbackPath("/caf%C3%A9?x=1"), "/");
    assert.equal(oauthCallbackPath("//evil.example"), "/");
    assert.equal(oauthCallbackPath(undefined), "/");
    for (const bad of [
      "/..//evil.example",
      "/.//evil.example",
      "/admin/..//evil.example",
      "/%2e%2e//evil.example",
    ]) {
      assert.equal(oauthCallbackPath(bad), "/", bad);
    }
  });
});
