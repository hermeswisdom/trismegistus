/**
 * Wall tiles clamp the meaning to 2 lines (phones) or 3 lines (from sm), so
 * shipping all ~110 full meanings in the homepage HTML is wasted weight. The
 * widest tile (2 columns just under lg, ~480px of text at text-xs) shows about
 * 240 characters, so 320 always fills the clamp: the tile looks the same. The
 * full text stays in the Read sheet, the wheel and each /?tablet= page.
 */
export const TILE_MEANING_CHARS = 320;

export function meaningExcerpt(text: string, max = TILE_MEANING_CHARS): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : flat.slice(0, max)).replace(/[\s,;:.–—-]+$/, "")}…`;
}
