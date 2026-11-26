import { parseSkinQueryValue } from "./solstice-skin.ts";

/** Canonical production origin. atmanmusic.app is live; .com was skipped / remains optional. */
export const SITE_ORIGIN = "https://atmanmusic.app";

export function tabletPagePath(opts: {
  daily?: boolean;
  tablet?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.daily) params.set("daily", "1");
  else if (opts.tablet) params.set("tablet", opts.tablet);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function tabletPageUrl(opts: {
  daily?: boolean;
  tablet?: string;
  origin?: string;
}): string {
  const origin = (opts.origin ?? SITE_ORIGIN).replace(/\/$/, "");
  return `${origin}${tabletPagePath(opts)}`;
}

/**
 * Home search. `mix` is reserved for Auto Mix share cards (`/api/og?mix=`)
 * and is not a focus field, so it cannot change the canonical or tablet.
 * `skin` is a QC override for the seasonal solstice night look; it is never
 * part of a share / canonical URL.
 */
export function parseHomeSearch(search: Record<string, unknown>): {
  daily?: 1;
  tablet?: string;
  skin?: "solstice" | "off";
} {
  const raw = search.daily;
  const daily =
    raw === true || raw === 1 || raw === "1" || raw === "true" ? 1 : undefined;
  const tablet =
    typeof search.tablet === "string" && search.tablet.trim()
      ? search.tablet.trim().slice(0, 80)
      : undefined;
  const skin = parseSkinQueryValue(search);
  return {
    ...(daily ? { daily } : {}),
    ...(tablet ? { tablet } : {}),
    ...(skin ? { skin } : {}),
  };
}
