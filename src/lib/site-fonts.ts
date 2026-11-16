/**
 * Same-origin Outfit / Syne files used by `src/styles.css` `@font-face`.
 * SIL OFL faces, latin + latin-ext, variable weight (the files Google Fonts
 * was already serving — without a render-blocking fonts.googleapis.com CSS).
 */
export const SITE_FONT_FILES = {
  outfitLatin: "/fonts/outfit-latin.woff2",
  outfitLatinExt: "/fonts/outfit-latin-ext.woff2",
  syneLatin: "/fonts/syne-latin.woff2",
  syneLatinExt: "/fonts/syne-latin-ext.woff2",
} as const;

/** First-paint faces. latin-ext is declared in CSS and fetched only if needed. */
export const SITE_FONT_PRELOADS = [
  SITE_FONT_FILES.outfitLatin,
  SITE_FONT_FILES.syneLatin,
] as const;
