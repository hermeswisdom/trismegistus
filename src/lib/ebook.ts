/**
 * The free Hermetic Collection ebook — pure data, no DOM or server imports.
 *
 * Free, public-domain texts served as same-origin static files from
 * public/ebook/. Kept apart from the paid master MP3 flow (masters.ts): no
 * price, no checkout, no sign-up or email gate.
 *
 * The files are cached for a year (see EBOOK_HEADERS / vite.config.ts), so a
 * revised edition must ship under a new file name, not over these ones.
 */

export const EBOOK_PAGE_PATH = "/ebook";
export const EBOOK_TITLE = "The Hermetic Collection";

/** One line, matching the book's actual contents (see its Contents page). */
export const EBOOK_DESCRIPTION =
  "The Hermetic Collection: The Kybalion, the Corpus Hermeticum (The Divine Pymander), the Emerald Tablet and the Wisdom of Solomon in one free book.";

export const EBOOK_NOTE = "Free · public domain";
export const EBOOK_PAGES = 240;

export type EbookFormat = "pdf" | "epub";

export type EbookFile = {
  format: EbookFormat;
  label: string;
  path: string;
  fileName: string;
  contentType: string;
  bytes: number;
  /** PDF opens in the browser's viewer when visited directly; EPUB saves. */
  disposition: "inline" | "attachment";
};

export const EBOOK_FILES: readonly EbookFile[] = [
  {
    format: "pdf",
    label: "Download PDF",
    path: "/ebook/The-Hermetic-Collection.pdf",
    fileName: "The-Hermetic-Collection.pdf",
    contentType: "application/pdf",
    bytes: 1_668_698,
    disposition: "inline",
  },
  {
    format: "epub",
    label: "Download EPUB",
    path: "/ebook/The-Hermetic-Collection.epub",
    fileName: "The-Hermetic-Collection.epub",
    contentType: "application/epub+zip",
    bytes: 1_294_660,
    disposition: "attachment",
  },
];

/** Cover: 1600×2560 source, served as 480/960 webp with a 640 jpg fallback. */
export const EBOOK_COVER = {
  webp480: "/ebook/cover-480.webp",
  webp960: "/ebook/cover-960.webp",
  jpg: "/ebook/cover-640.jpg",
  width: 640,
  height: 1024,
  alt: "Cover of The Hermetic Collection: The Kybalion, The Divine Pymander, The Emerald Tablet, The Wisdom of Solomon",
} as const;

export const EBOOK_CONTENTS: readonly { title: string; note: string }[] = [
  {
    title: "The Kybalion",
    note: "Three Initiates, 1908. The seven Hermetic Principles.",
  },
  {
    title: "The Divine Pymander",
    note: "The Corpus Hermeticum in John Everard’s 1650 English translation.",
  },
  {
    title: "The Emerald Tablet",
    note: "Isaac Newton’s translation (c. 1680), with the version quoted by H. P. Blavatsky.",
  },
  {
    title: "The Wisdom of Solomon",
    note: "King James Version, 1611.",
  },
];

export const EBOOK_SOURCES_LINE =
  "Texts from Project Gutenberg and the Internet Sacred Text Archive; full sources and licence at the end of the book.";

/** A year; the files never change in place (see the note at the top). */
export const EBOOK_CACHE_CONTROL = "public, max-age=31536000, immutable";

export function ebookFile(format: EbookFormat): EbookFile {
  const file = EBOOK_FILES.find((f) => f.format === format);
  if (!file) throw new Error(`unknown ebook format: ${format}`);
  return file;
}

export function parseEbookFormat(value: unknown): EbookFormat | null {
  return value === "pdf" || value === "epub" ? value : null;
}

/** 1_668_698 → "1.7 MB" (decimal megabytes, one place). */
export function formatMegabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** Response headers for the static files (applied as Nitro route rules). */
export function ebookHeaders(): Record<string, Record<string, string>> {
  const rules: Record<string, Record<string, string>> = {
    "/ebook/**": { "cache-control": EBOOK_CACHE_CONTROL },
  };
  for (const file of EBOOK_FILES) {
    rules[file.path] = {
      "cache-control": EBOOK_CACHE_CONTROL,
      "content-type": file.contentType,
      "content-disposition": `${file.disposition}; filename="${file.fileName}"`,
    };
  }
  return rules;
}
