import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SOUNDCLOUD_TRACKS } from "./soundcloud-tracks.ts";
import { buildSitemap, trackIds } from "../../scripts/generate-sitemap.mjs";

const read = (p: string) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("public/sitemap.xml", () => {
  it("lists every track and matches the generator (run scripts/generate-sitemap.mjs)", () => {
    const ids = trackIds(read("src/lib/soundcloud-tracks.ts"));
    assert.deepEqual(ids, SOUNDCLOUD_TRACKS.map((t) => t.id));
    assert.equal(read("public/sitemap.xml"), buildSitemap(ids));
  });
  it("includes the main routes and per-track deep links", () => {
    const xml = read("public/sitemap.xml");
    assert.match(xml, /<loc>https:\/\/atmanmusic\.app\/<\/loc>/);
    assert.match(xml, /<loc>https:\/\/atmanmusic\.app\/download<\/loc>/);
    assert.match(xml, /<loc>https:\/\/atmanmusic\.app\/ebook<\/loc>/);
    assert.match(xml, new RegExp(`/\\?tablet=${SOUNDCLOUD_TRACKS[0].id}<`));
  });
});

describe("public/robots.txt", () => {
  it("allows the site, disallows /api/ and points at the sitemap", () => {
    const txt = read("public/robots.txt");
    assert.match(txt, /^User-agent: \*$/m);
    assert.match(txt, /^Allow: \/$/m);
    assert.match(txt, /^Disallow: \/api\/$/m);
    assert.match(txt, /^Sitemap: https:\/\/atmanmusic\.app\/sitemap\.xml$/m);
  });
});
