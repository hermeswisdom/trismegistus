import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  EBOOK_CACHE_CONTROL,
  EBOOK_COVER,
  EBOOK_DESCRIPTION,
  EBOOK_FILES,
  EBOOK_NOTE,
  ebookFile,
  ebookHeaders,
  formatMegabytes,
  parseEbookFormat,
} from "./ebook.ts";

const pub = (p: string) => new URL(`../../public${p}`, import.meta.url);
const src = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("free ebook files", () => {
  it("ships the PDF and EPUB unchanged, with the declared byte sizes", () => {
    for (const file of EBOOK_FILES) {
      assert.equal(fs.statSync(pub(file.path)).size, file.bytes, file.path);
      assert.equal(file.path, `/ebook/${file.fileName}`);
      assert.match(file.fileName, /^The-Hermetic-Collection\.(pdf|epub)$/);
    }
    assert.equal(fs.readFileSync(pub(ebookFile("pdf").path)).subarray(0, 5).toString(), "%PDF-");
    const epub = fs.readFileSync(pub(ebookFile("epub").path));
    // OCF: the first entry is an uncompressed "mimetype" file.
    assert.equal(epub.subarray(30, 38).toString(), "mimetype");
    assert.equal(epub.subarray(38, 58).toString(), "application/epub+zip");
  });

  it("has the optimised cover images", () => {
    for (const p of [EBOOK_COVER.webp480, EBOOK_COVER.webp960, EBOOK_COVER.jpg]) {
      const size = fs.statSync(pub(p)).size;
      assert.ok(size > 5_000 && size < 200_000, `${p} is ${size} bytes`);
    }
  });

  it("serves exact content types, clean names and a long cache", () => {
    const rules = ebookHeaders();
    assert.equal(rules["/ebook/**"]["cache-control"], EBOOK_CACHE_CONTROL);
    assert.match(EBOOK_CACHE_CONTROL, /max-age=31536000/);
    assert.deepEqual(rules["/ebook/The-Hermetic-Collection.pdf"], {
      "cache-control": EBOOK_CACHE_CONTROL,
      "content-type": "application/pdf",
      "content-disposition": 'inline; filename="The-Hermetic-Collection.pdf"',
    });
    assert.deepEqual(rules["/ebook/The-Hermetic-Collection.epub"], {
      "cache-control": EBOOK_CACHE_CONTROL,
      "content-type": "application/epub+zip",
      "content-disposition": 'attachment; filename="The-Hermetic-Collection.epub"',
    });
  });

  it("formats sizes and parses formats", () => {
    assert.equal(formatMegabytes(1_668_698), "1.7 MB");
    assert.equal(formatMegabytes(1_294_660), "1.3 MB");
    assert.equal(parseEbookFormat("pdf"), "pdf");
    assert.equal(parseEbookFormat("epub"), "epub");
    assert.equal(parseEbookFormat("mp3"), null);
    assert.equal(parseEbookFormat(undefined), null);
  });
});

describe("free ebook copy", () => {
  it("names the four texts that are actually in the book", () => {
    for (const t of ["Kybalion", "Corpus Hermeticum", "Divine Pymander", "Emerald Tablet", "Wisdom of Solomon"]) {
      assert.ok(EBOOK_DESCRIPTION.includes(t), t);
    }
    assert.equal(EBOOK_NOTE, "Free · public domain");
  });

  it("stays apart from the paid master UI: no price, checkout or payment wording", () => {
    const ui = [src("components/free-ebook.tsx"), src("routes/ebook.tsx"), src("lib/ebook.ts"), src("lib/ebook-client.ts")]
      .join("\n")
      // the doc comments may say what the ebook is *not*
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(ui, /£|\$\d|€|\b(price|priced|stripe|checkout|buy|purchase|pay|paid|payment|order|cart|masters?)\b/i);
    assert.doesNotMatch(ui, /buy-master|master-checkout/);
  });
});
