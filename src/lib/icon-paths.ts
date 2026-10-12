/**
 * Path data for the icons repeated on every wall tile (Read, Heart, Share,
 * Mark, Download), copied from lucide-react 0.510.0.
 * They render once as <symbol>s in <IconSprite /> (root layout) and each use
 * site is a small <svg><use href="#i-…" /></svg>, instead of ~110 full inline
 * copies per icon on the homepage. icon-sprite.test.ts checks they still match
 * lucide's own __iconNode.
 */
export type IconNode = ReadonlyArray<readonly [string, Readonly<Record<string, string>>]>;

export const SPRITE_ICONS = {
  book: [["path",{"d":"M12 7v14"}],["path",{"d":"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"}]],
  check: [["path",{"d":"M20 6 9 17l-5-5"}]],
  download: [["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}],["polyline",{"points":"7 10 12 15 17 10"}],["line",{"x1":"12","x2":"12","y1":"15","y2":"3"}]],
  heart: [["path",{"d":"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"}]],
  mark: [["path",{"d":"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"}]],
  share: [["circle",{"cx":"18","cy":"5","r":"3"}],["circle",{"cx":"6","cy":"12","r":"3"}],["circle",{"cx":"18","cy":"19","r":"3"}],["line",{"x1":"8.59","x2":"15.42","y1":"13.51","y2":"17.49"}],["line",{"x1":"15.41","x2":"8.59","y1":"6.51","y2":"10.49"}]],
} as const satisfies Record<string, IconNode>;

export type SpriteIconName = keyof typeof SPRITE_ICONS;
export const LUCIDE_FILES: Record<SpriteIconName, string> = {"book":"book-open","check":"check","download":"download","heart":"heart","mark":"message-square","share":"share-2"};

