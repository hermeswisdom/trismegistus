import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { productionGrokAuthConfigured } from "./production-oauth.ts";

describe("productionGrokAuthConfigured", () => {
  it("is false for the preview fallback (no GROK_AUTH_*)", () => {
    assert.equal(productionGrokAuthConfigured({}), false);
    assert.equal(
      productionGrokAuthConfigured({
        BETTER_AUTH_URL: "https://trismegistus-three.vercel.app",
        VERCEL: "1",
      }),
      false,
    );
  });

  it("is true only when both per-app broker fields are set", () => {
    assert.equal(
      productionGrokAuthConfigured({ GROK_AUTH_CLIENT_ID: "app_live" }),
      false,
    );
    assert.equal(
      productionGrokAuthConfigured({
        GROK_AUTH_CLIENT_ID: "app_live",
        GROK_AUTH_CLIENT_SECRET: "secret",
      }),
      true,
    );
    assert.equal(
      productionGrokAuthConfigured({
        GROK_AUTH_CLIENT_ID: "  ",
        GROK_AUTH_CLIENT_SECRET: "secret",
      }),
      false,
    );
  });
});
