import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chooseVisitorKey, extractClientIp } from "./visitor-key.ts";

describe("extractClientIp", () => {
  it("takes the first forwarded hop, then x-real-ip", () => {
    const headers = new Headers({
      "x-forwarded-for": " 203.0.113.9, 10.0.0.1 ",
      "x-real-ip": "198.51.100.2",
    });
    assert.equal(extractClientIp(headers), "203.0.113.9");
    assert.equal(extractClientIp(new Headers({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
    assert.equal(extractClientIp(new Headers()), null);
  });
});

describe("chooseVisitorKey", () => {
  it("prefers the cookie and falls back to IP", () => {
    assert.equal(chooseVisitorKey("abc", "203.0.113.9"), "c:abc");
    assert.equal(chooseVisitorKey("  ", "203.0.113.9"), "i:203.0.113.9");
    assert.equal(chooseVisitorKey(null, null), "anon");
  });
});
