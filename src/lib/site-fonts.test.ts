import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { SITE_FONT_FILES, SITE_FONT_PRELOADS } from "./site-fonts.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("self-hosted site fonts", () => {
  it("ships woff2 files at the CSS / preload paths", () => {
    for (const href of Object.values(SITE_FONT_FILES)) {
      const file = join(ROOT, "public", href);
      assert.equal(existsSync(file), true, href);
      const buf = readFileSync(file);
      assert.equal(buf.subarray(0, 4).toString("ascii"), "wOF2", href);
      assert.ok(statSync(file).size < 80_000, `${href} stays a single face`);
    }
  });

  it("preloads only the latin faces used on first paint", () => {
    assert.deepEqual([...SITE_FONT_PRELOADS], [
      SITE_FONT_FILES.outfitLatin,
      SITE_FONT_FILES.syneLatin,
    ]);
  });
});

describe("homepage styling is not render-blocking", () => {
  it("hoists the app stylesheet and preloads self-hosted fonts ahead of cover images", () => {
    const root = read("src/routes/__root.tsx");
    assert.match(root, /from "\.\.\/styles\.css\?url"/);
    assert.doesNotMatch(root, /styles\.css\?inline/);
    assert.doesNotMatch(root, /fonts\.googleapis\.com/);
    assert.doesNotMatch(root, /fonts\.gstatic\.com/);
    assert.match(root, /rel: "stylesheet"/);
    assert.match(root, /precedence: "high"/);
    assert.match(root, /from "react-dom"/);
    assert.match(root, /preload\(href, \{ as: "font"/);
    assert.match(root, /SITE_FONT_PRELOADS/);
  });

  it("keeps eager homepage covers from promoting ahead of CSS", () => {
    const mosaic = read("src/components/cover-mosaic.tsx");
    const mark = read("src/components/site-mark.tsx");
    const wall = read("src/components/track-wall.tsx");
    assert.match(mosaic, /fetchPriority="low"/);
    assert.match(mark, /fetchPriority="low"/);
    assert.match(wall, /fetchPriority="low"/);
  });

  it("declares Outfit and Syne with font-display:swap against the local files", () => {
    const css = read("src/styles.css");
    assert.match(css, /font-family: "Outfit"/);
    assert.match(css, /font-family: "Syne"/);
    assert.equal([...css.matchAll(/font-display: swap/g)].length >= 4, true);
    for (const href of Object.values(SITE_FONT_FILES)) {
      assert.match(css, new RegExp(href.replaceAll("/", "\\/")));
    }
    assert.doesNotMatch(css, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });
});
