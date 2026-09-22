import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SOUNDCLOUD_TRACKS } from "./soundcloud-tracks.ts";
import type { Track } from "./rooms.ts";
import {
  catalogMasterPaths,
  contentDisposition,
  defaultMasterDownloadKey,
  dryRunSessionId,
  formatMasterPrice,
  isDryRunSessionId,
  masterBuyLabel,
  masterFilename,
  masterPricePence,
  parseSaleSlugs,
  resolveSaleDownloadKey,
  saleDownloadKey,
  sanitizeMasterDownloadKey,
  trackIdFromDryRunSession,
  trackIsForSale,
} from "./masters.ts";

describe("catalog master mapping", () => {
  it("maps every catalog id to masters/<slug>.mp3", () => {
    const paths = catalogMasterPaths();
    assert.equal(Object.keys(paths).length, SOUNDCLOUD_TRACKS.length);
    for (const track of SOUNDCLOUD_TRACKS) {
      assert.equal(paths[track.id], `masters/${track.slug}.mp3`);
      assert.equal(paths[track.id].includes("soundcloud"), false);
    }
  });

  it("only lists The Sleepers Waking for sale until more masters are uploaded", () => {
    const forSale = (SOUNDCLOUD_TRACKS as Track[]).filter(trackIsForSale);
    assert.equal(forSale.length, 1);
    assert.equal(forSale[0]?.id, "the-sleepers-waking");
    assert.equal(saleDownloadKey(forSale[0]!), "masters/the-sleepers-waking.mp3");
  });

  it("rejects path traversal and SoundCloud URLs as download keys", () => {
    assert.equal(sanitizeMasterDownloadKey("../secret.mp3"), undefined);
    assert.equal(
      sanitizeMasterDownloadKey("https://soundcloud.com/esoteric_vibrations/awake"),
      undefined,
    );
    assert.equal(sanitizeMasterDownloadKey("masters/awake.mp3"), "masters/awake.mp3");
  });

  it("enables extra slugs from MASTER_SALE_SLUGS without ripping streams", () => {
    const track = SOUNDCLOUD_TRACKS.find((row) => row.id === "fragile-god")!;
    assert.equal(trackIsForSale(track), false);
    assert.equal(
      resolveSaleDownloadKey(track, new Set(["fragile-god"])),
      "masters/fragile-god.mp3",
    );
    assert.equal(resolveSaleDownloadKey(track, "all"), "masters/fragile-god.mp3");
  });
});

describe("master price", () => {
  it("defaults to £0.99 / 99 pence", () => {
    assert.equal(masterPricePence(), 99);
    assert.equal(formatMasterPrice(), "£0.99");
    assert.equal(masterBuyLabel(), "Download MP3 · £0.99");
  });

  it("ignores nonsense env values", () => {
    assert.equal(masterPricePence("nope"), 99);
    assert.equal(masterPricePence("10"), 99);
    assert.equal(masterPricePence("149"), 149);
  });
});

describe("download naming", () => {
  it("keeps a personal-use filename off SoundCloud", () => {
    assert.equal(
      masterFilename({ title: "The Sleepers Waking", slug: "the-sleepers-waking" }),
      "The Sleepers Waking — Atman Music.mp3",
    );
    assert.match(contentDisposition("The Sleepers Waking — Atman Music.mp3"), /attachment/);
  });

  it("builds dry-run session ids that round-trip the track id", () => {
    const id = dryRunSessionId("the-sleepers-waking", "ab12cd34");
    assert.equal(isDryRunSessionId(id), true);
    assert.equal(trackIdFromDryRunSession(id), "the-sleepers-waking");
  });
});

describe("parseSaleSlugs", () => {
  it("reads comma lists and *", () => {
    assert.deepEqual([...parseSaleSlugs("fragile-god, awake")!], ["fragile-god", "awake"]);
    assert.equal(parseSaleSlugs("*"), "all");
    assert.equal(parseSaleSlugs(""), undefined);
  });
});

describe("defaultMasterDownloadKey", () => {
  it("rejects empty and dotted slugs", () => {
    assert.throws(() => defaultMasterDownloadKey("../x"));
    assert.equal(defaultMasterDownloadKey("7-signs-silent-danger"), "masters/7-signs-silent-danger.mp3");
  });
});
