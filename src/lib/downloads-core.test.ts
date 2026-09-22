import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DOWNLOAD_PRICE_GBP,
  downloadFilename,
  formatGbp,
  getSellableTrack,
  isDryRunSessionId,
  masterBlobPath,
  parsePositiveInt,
  parsePriceGbp,
  parsePriceIdMap,
  priceToPence,
  trackHasMaster,
} from "./downloads-core.ts";
import {
  signDownloadGrant,
  verifyDownloadGrant,
} from "./download-token.ts";
import {
  allowDryRunDownloads,
  allowFixtureMaster,
  serverPriceGbp,
} from "./downloads-core.ts";
import { SOUNDCLOUD_TRACKS } from "./soundcloud-tracks.ts";

describe("download price", () => {
  it("defaults to £1.99 scaffolding", () => {
    assert.equal(DEFAULT_DOWNLOAD_PRICE_GBP, 1.99);
    assert.equal(parsePriceGbp(undefined), 1.99);
    assert.equal(parsePriceGbp(""), 1.99);
    assert.equal(parsePriceGbp("nope"), 1.99);
    assert.equal(priceToPence(1.99), 199);
    assert.equal(formatGbp(1.99), "£1.99");
  });

  it("accepts a positive GBP override", () => {
    assert.equal(parsePriceGbp("2.5"), 2.5);
    assert.equal(priceToPence(2.5), 250);
  });
});

describe("master mapping", () => {
  it("maps slug, filename, or blob path to masters/<slug>.mp3", () => {
    assert.equal(masterBlobPath("the-sleepers-waking"), "masters/the-sleepers-waking.mp3");
    assert.equal(masterBlobPath("the-sleepers-waking.mp3"), "masters/the-sleepers-waking.mp3");
    assert.equal(
      masterBlobPath("masters/the-sleepers-waking.mp3"),
      "masters/the-sleepers-waking.mp3",
    );
  });

  it("only sells tablets with a downloadKey", () => {
    const sample = SOUNDCLOUD_TRACKS.find((track) => track.id === "the-sleepers-waking");
    const other = SOUNDCLOUD_TRACKS.find((track) => track.id === "fragile-god");
    assert.equal(trackHasMaster(sample), true);
    assert.equal(trackHasMaster(other), false);
    assert.equal(
      getSellableTrack("the-sleepers-waking", SOUNDCLOUD_TRACKS)?.id,
      "the-sleepers-waking",
    );
    assert.equal(getSellableTrack("fragile-god", SOUNDCLOUD_TRACKS), undefined);
    assert.equal(downloadFilename({ slug: "the-sleepers-waking", title: "X" }), "the-sleepers-waking.mp3");
  });
});

describe("price id map", () => {
  it("reads Stripe price_ ids from JSON", () => {
    const map = parsePriceIdMap(
      '{"the-sleepers-waking":"price_abc","nope":"not-a-price"}',
    );
    assert.equal(map["the-sleepers-waking"], "price_abc");
    assert.equal(map.nope, undefined);
    assert.deepEqual(parsePriceIdMap("not-json"), {});
  });

  it("parses bounded positive integers", () => {
    assert.equal(parsePositiveInt("48", 12), 48);
    assert.equal(parsePositiveInt("0", 6), 6);
    assert.equal(parsePositiveInt("nope", 6), 6);
  });
});

describe("download grant token", () => {
  it("signs and verifies a time-limited grant", () => {
    const grant = {
      sessionId: "cs_test_123",
      trackId: "the-sleepers-waking",
      exp: 2_000_000_000,
    };
    const token = signDownloadGrant(grant, "secret");
    assert.deepEqual(verifyDownloadGrant(token, "secret", 1_700_000_000), grant);
    assert.equal(verifyDownloadGrant(token, "other", 1_700_000_000), null);
    assert.equal(verifyDownloadGrant(token, "secret", 2_000_000_001), null);
    assert.equal(verifyDownloadGrant("tampered." + token.split(".")[1], "secret"), null);
  });
});

describe("dry-run gates", () => {
  it("allows dry-run when Stripe is unset off production", () => {
    assert.equal(allowDryRunDownloads({}), true);
    assert.equal(
      allowDryRunDownloads({ VERCEL_ENV: "production" }),
      false,
    );
    assert.equal(
      allowDryRunDownloads({ STRIPE_SECRET_KEY: "sk_test_x" }),
      false,
    );
    assert.equal(
      allowDryRunDownloads({
        STRIPE_SECRET_KEY: "sk_test_x",
        DOWNLOAD_DRY_RUN: "true",
      }),
      true,
    );
    assert.equal(isDryRunSessionId("dry_abc"), true);
    assert.equal(isDryRunSessionId("cs_test_abc"), false);
  });

  it("serves the fixture when Blob is unset off production", () => {
    assert.equal(allowFixtureMaster({}), true);
    assert.equal(
      allowFixtureMaster({
        VERCEL_ENV: "production",
        STRIPE_SECRET_KEY: "sk_live_x",
      }),
      false,
    );
    assert.equal(
      allowFixtureMaster({
        VERCEL_ENV: "production",
        STRIPE_SECRET_KEY: "sk_live_x",
        DOWNLOAD_ALLOW_FIXTURE: "true",
      }),
      true,
    );
  });

  it("reads server price from TRACK_DOWNLOAD_PRICE_GBP", () => {
    assert.equal(serverPriceGbp({}), 1.99);
    assert.equal(serverPriceGbp({ TRACK_DOWNLOAD_PRICE_GBP: "3" }), 3);
  });
});
