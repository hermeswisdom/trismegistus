/**
 * Share-card URLs, mood palettes and OG/Twitter meta.
 *
 * Pure (no React, no fs) so `node --test` and the client share button can
 * both load it. `/api/og` renders the PNG; `?mix=` is parsed and reserved
 * for Auto Mix cards (currently falls through to the default brand card).
 */
import { SITE_ORIGIN } from "./tablet-link.ts";

export const SITE_NAME = "Atman Music";
export const OG_PATH = "/api/og";
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_CACHE_CONTROL =
  "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";

export const OG_MOODS = ["chill", "hype", "dark", "happy", "dreamy", "epic"] as const;
export type OgMood = (typeof OG_MOODS)[number];

export type OgCardKind = "default" | "track" | "mix";

/** Colours drawn from the site theme (`src/styles.css`) plus a per-mood accent. */
export type OgPalette = {
  bg: string;
  fg: string;
  muted: string;
  accent: string;
  glow: string;
};

export const SITE_PALETTE: OgPalette = {
  bg: "#09080e",
  fg: "#f4efe4",
  muted: "#a39b8c",
  accent: "#d6e24a",
  glow: "#d6e24a",
};

export const MOOD_PALETTES: Record<OgMood, OgPalette> = {
  chill: { bg: "#0b1211", fg: "#eef4f1", muted: "#8aa9a2", accent: "#7ec8b8", glow: "#7ec8b8" },
  hype: { bg: "#140a08", fg: "#f4efe4", muted: "#c4a090", accent: "#ff5a36", glow: "#ff8a5c" },
  dark: { bg: "#0a0812", fg: "#f4efe4", muted: "#8a84a8", accent: "#7b5cff", glow: "#9b86ff" },
  happy: { bg: "#141108", fg: "#f4efe4", muted: "#b8a878", accent: "#f0c84a", glow: "#f0c84a" },
  dreamy: { bg: "#0c0a16", fg: "#f4efe4", muted: "#9a90b8", accent: "#c9a8ff", glow: "#c9a8ff" },
  epic: { bg: "#120c08", fg: "#f4efe4", muted: "#b8a070", accent: "#e8b84a", glow: "#e8b84a" },
};

export function isOgMood(value: string | undefined | null): value is OgMood {
  return OG_MOODS.includes(value as OgMood);
}

function originFrom(origin?: string): string {
  return (origin ?? SITE_ORIGIN).replace(/\/$/, "");
}

/**
 * Origin for absolute og:image URLs. Production always uses atmanmusic.app;
 * preview deployments use the Vercel URL so crawler checks hit this build.
 */
export function publicOrigin(requestUrl?: string): string {
  if (process.env.VERCEL_ENV === "production") return SITE_ORIGIN;
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (requestUrl) {
    try {
      return new URL(requestUrl).origin;
    } catch {
      /* fall through */
    }
  }
  return SITE_ORIGIN;
}

export function parseOgSearch(
  search: URLSearchParams | string | Record<string, string | undefined>,
): { kind: OgCardKind; slug?: string; mix?: string } {
  const params =
    search instanceof URLSearchParams
      ? search
      : typeof search === "string"
        ? new URLSearchParams(search)
        : new URLSearchParams(
            Object.entries(search).filter((entry): entry is [string, string] => Boolean(entry[1])),
          );
  const mix = params.get("mix")?.trim().slice(0, 80) || undefined;
  const slug = params.get("slug")?.trim().slice(0, 80) || undefined;
  // Mix cards are a later hook: recognise the param so /api/og?mix= is stable.
  if (mix) return { kind: "mix", mix, ...(slug ? { slug } : {}) };
  if (slug) return { kind: "track", slug };
  return { kind: "default" };
}

export function ogCardPath(opts: { slug?: string; mix?: string } = {}): string {
  const params = new URLSearchParams();
  if (opts.mix) params.set("mix", opts.mix);
  else if (opts.slug) params.set("slug", opts.slug);
  const query = params.toString();
  return query ? `${OG_PATH}?${query}` : OG_PATH;
}

export function ogCardUrl(
  opts: { slug?: string; mix?: string; origin?: string } = {},
): string {
  return `${originFrom(opts.origin)}${ogCardPath(opts)}`;
}

/** Path humans land on after a share unfurl (`/t/<slug>` → `/?tablet=<slug>`). */
export function shareTabletPath(slug: string): string {
  return `/t/${encodeURIComponent(slug)}`;
}

export function shareTabletUrl(slug: string, origin?: string): string {
  return `${originFrom(origin)}${shareTabletPath(slug)}`;
}

/** Reserved: Auto Mix share links will use this once mix cards exist. */
export function mixPageUrl(mix: string, origin?: string): string {
  const params = new URLSearchParams();
  params.set("mix", mix);
  return `${originFrom(origin)}/?${params.toString()}`;
}

export function titleFontSize(title: string): number {
  if (title.length > 42) return 40;
  if (title.length > 28) return 48;
  if (title.length > 18) return 56;
  return 64;
}

export type ShareMetaTag =
  | { property: string; content: string }
  | { name: string; content: string };

export type OgCardMeta = {
  title: string;
  description: string;
  url: string;
  image: string;
  imageAlt: string;
  siteName: string;
};

export function shareMetaTags(
  card: OgCardMeta,
  description = card.description,
): ShareMetaTag[] {
  const { width, height } = OG_IMAGE_SIZE;
  return [
    { property: "og:title", content: card.title },
    { property: "og:description", content: description },
    { property: "og:image", content: card.image },
    { property: "og:image:alt", content: card.imageAlt },
    { property: "og:image:width", content: String(width) },
    { property: "og:image:height", content: String(height) },
    { property: "og:url", content: card.url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: card.siteName },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: card.title },
    { name: "twitter:description", content: description },
    { name: "twitter:url", content: card.url },
    { name: "twitter:image", content: card.image },
  ];
}
