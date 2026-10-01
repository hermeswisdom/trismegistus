import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canRedeemPurchase,
  downloadsLeft,
  signDownloadToken,
  verifyDownloadToken,
} from "./download-token.ts";

const SECRET = "test-master-secret";

describe("download tokens", () => {
  it("round-trips a grant", async () => {
    const token = await signDownloadToken(
      {
        sid: "cs_test_1",
        tid: "the-sleepers-waking",
        key: "masters/the-sleepers-waking.mp3",
        rec: "abc123",
      },
      SECRET,
    );
    const grant = await verifyDownloadToken(token, SECRET);
    assert.equal(grant.sid, "cs_test_1");
    assert.equal(grant.tid, "the-sleepers-waking");
    assert.equal(grant.key, "masters/the-sleepers-waking.mp3");
    assert.equal(grant.rec, "abc123");
  });

  it("rejects the wrong secret", async () => {
    const token = await signDownloadToken(
      {
        sid: "cs_test_1",
        tid: "the-sleepers-waking",
        key: "masters/the-sleepers-waking.mp3",
        rec: "abc123",
      },
      SECRET,
    );
    await assert.rejects(() => verifyDownloadToken(token, "other"));
  });
});

describe("purchase gate", () => {
  it("allows a fresh receipt and blocks expiry / exhausted uses", () => {
    const now = Date.parse("2026-09-22T12:00:00Z");
    assert.deepEqual(
      canRedeemPurchase(
        { expiresAtMs: now + 60_000, downloadCount: 0, maxDownloads: 8 },
        now,
      ),
      { ok: true },
    );
    assert.equal(
      canRedeemPurchase(
        { expiresAtMs: now - 1, downloadCount: 0, maxDownloads: 8 },
        now,
      ).ok,
      false,
    );
    assert.equal(
      canRedeemPurchase(
        { expiresAtMs: now + 60_000, downloadCount: 8, maxDownloads: 8 },
        now,
      ).ok,
      false,
    );
    assert.equal(downloadsLeft({ downloadCount: 3, maxDownloads: 8 }), 5);
  });
});
