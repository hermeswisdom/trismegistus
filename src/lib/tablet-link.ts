/** Working Vercel Production alias. Custom domain atmanmusic.com is not live yet. */
export const SITE_ORIGIN = "https://trismegistus-smlc-1397.vercel.app";

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

export function parseHomeSearch(search: Record<string, unknown>): {
  daily?: 1;
  tablet?: string;
} {
  const raw = search.daily;
  const daily =
    raw === true || raw === 1 || raw === "1" || raw === "true" ? 1 : undefined;
  const tablet =
    typeof search.tablet === "string" && search.tablet.trim()
      ? search.tablet.trim().slice(0, 80)
      : undefined;
  return {
    ...(daily ? { daily } : {}),
    ...(tablet ? { tablet } : {}),
  };
}
