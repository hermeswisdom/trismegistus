import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizePgSslMode } from "./pg-url.ts";

describe("normalizePgSslMode", () => {
  it("rewrites the aliased modes to verify-full", () => {
    assert.equal(normalizePgSslMode("postgres://u:p@h/db?sslmode=require"), "postgres://u:p@h/db?sslmode=verify-full");
    assert.equal(
      normalizePgSslMode("postgres://u:p@h/db?sslmode=require&channel_binding=require"),
      "postgres://u:p@h/db?sslmode=verify-full&channel_binding=require",
    );
    assert.equal(normalizePgSslMode("postgres://h/db?a=1&sslmode=prefer"), "postgres://h/db?a=1&sslmode=verify-full");
    assert.equal(normalizePgSslMode("postgres://h/db?sslmode=verify-ca"), "postgres://h/db?sslmode=verify-full");
  });
  it("leaves other URLs alone", () => {
    for (const u of [
      "postgres://h/db",
      "postgres://h/db?sslmode=disable",
      "postgres://h/db?sslmode=verify-full",
      "postgres://h/db?uselibpqcompat=true&sslmode=require",
    ]) assert.equal(normalizePgSslMode(u), u);
  });
});
