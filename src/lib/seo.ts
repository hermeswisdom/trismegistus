/**
 * Search metadata: absolute canonicals, JSON-LD and the home description.
 *
 * Pure (no app imports beyond plain data modules) so `node --test` can load it.
 * Every value here comes from data already in the codebase: the catalogue, the
 * meanings, the master price and the ebook. Nothing is invented (no durations,
 * no release dates beyond each track's `recorded` month).
 */
import type { DetailedHTMLProps, MetaHTMLAttributes } from "react";
import { SOUNDCLOUD_PROFILE, X_PROFILE } from "./artist.ts";
import {
  EBOOK_CONTENTS,
  EBOOK_COVER,
  EBOOK_DESCRIPTION,
  EBOOK_PAGE_PATH,
  EBOOK_PAGES,
  EBOOK_TITLE,
} from "./ebook.ts";
import { SITE_ORIGIN, tabletPageUrl } from "./tablet-link.ts";

export const SEO_SITE_NAME = "Atman Music";
/** The public name across the site; "Atman" is the artist tag on the streams. */
export const ARTIST_NAME = "Atman Music";
export const ARTIST_ALTERNATE_NAME = "Atman";
export const ARTIST_SAME_AS: readonly string[] = [SOUNDCLOUD_PROFILE, X_PROFILE];

export const HOME_URL = `${SITE_ORIGIN}/`;
export const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
export const ARTIST_ID = `${SITE_ORIGIN}/#artist`;

const SCHEMA = "https://schema.org";

export type JsonLdNode = Record<string, unknown>;
export type JsonLdGraph = { "@context": string; "@graph": JsonLdNode[] };

/** Absolute URL for a site path or asset ("/ebook", "/images/x.jpg"). */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Canonical for a plain route: origin + path, no query, no trailing slash. */
export function pageCanonical(path: string): string {
  const clean = path.split(/[?#]/, 1)[0] ?? "/";
  if (clean === "" || clean === "/") return HOME_URL;
  return absoluteUrl(clean.replace(/\/+$/, ""));
}

/**
 * Canonical for the home route. A resolved `?tablet=` canonicalises to its own
 * `/?tablet=<slug>`; `?daily=1` to today's tablet (the same content under a
 * stable URL); anything else (bare `/`, unknown tablet, qc/debug/utm params)
 * to `/`. Only `tablet` can survive, because it is the only input.
 */
export function homeCanonical(focus: {
  source: "daily" | "tablet" | "none";
  slug?: string;
}): string {
  if (focus.source === "none" || !focus.slug) return HOME_URL;
  return tabletPageUrl({ tablet: focus.slug });
}

/** "September 2026" → "2026-09" (W3C date, month precision). */
export function recordedIsoMonth(recorded: string | undefined): string | undefined {
  const match = /^([A-Za-z]+)\s+(\d{4})$/.exec(String(recorded ?? "").trim());
  if (!match) return undefined;
  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];
  const index = months.indexOf(match[1]!.toLowerCase());
  if (index < 0) return undefined;
  return `${match[2]}-${String(index + 1).padStart(2, "0")}`;
}

export function formatGbp(pence: number): string {
  return (pence / 100).toFixed(2);
}

/** Home meta description (also og:/twitter:description on the bare home). */
export function homeDescription(input: { trackCount: number; pricePence: number }): string {
  return (
    `Atman Music: ${input.trackCount} tracks, each with its cover art and the meaning ` +
    `behind it. Play free, spin the wheel, buy a master MP3 for £${formatGbp(input.pricePence)} ` +
    "or read the free Hermetic ebook."
  );
}

/** `google-site-verification` meta, or nothing when the env value is empty. */
export function siteVerificationMeta(
  token: string | undefined,
): { name: string; content: string }[] {
  const value = String(token ?? "").trim();
  return value ? [{ name: "google-site-verification", content: value }] : [];
}

export function jsonLdGraph(nodes: JsonLdNode[]): JsonLdGraph {
  return { "@context": SCHEMA, "@graph": nodes };
}

type MetaTag = DetailedHTMLProps<MetaHTMLAttributes<HTMLMetaElement>, HTMLMetaElement>;

/**
 * TanStack head meta entry that renders `<script type="application/ld+json">`
 * (router `buildTagsFromMatches` handles the `script:ld+json` key and escapes
 * `<`, `>` and `&`). Its meta type only lists `<meta>` attributes, hence the cast.
 */
export function jsonLdMeta(nodes: JsonLdNode[]): MetaTag {
  return { "script:ld+json": jsonLdGraph(nodes) } as unknown as MetaTag;
}

export function artistJsonLd(): JsonLdNode {
  return {
    "@type": "MusicGroup",
    "@id": ARTIST_ID,
    name: ARTIST_NAME,
    alternateName: ARTIST_ALTERNATE_NAME,
    url: HOME_URL,
    sameAs: [...ARTIST_SAME_AS],
  };
}

export function websiteJsonLd(description: string): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SEO_SITE_NAME,
    url: HOME_URL,
    description,
    inLanguage: "en",
    publisher: { "@id": ARTIST_ID },
  };
}

export function breadcrumbJsonLd(items: readonly { name: string; url: string }[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export type RecordingInput = {
  title: string;
  slug: string;
  image: string;
  permalink?: string;
  recorded?: string;
};

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * MusicRecording for one tablet. `pricePence` only when the track has a master
 * for sale (offers the MP3 download). No duration: the catalogue has none.
 */
export function recordingJsonLd(input: {
  track: RecordingInput;
  meaning?: string;
  pricePence?: number;
}): JsonLdNode {
  const url = tabletPageUrl({ tablet: input.track.slug });
  const description = input.meaning ? collapse(input.meaning) : "";
  const dateCreated = recordedIsoMonth(input.track.recorded);
  return {
    "@type": "MusicRecording",
    "@id": `${url}#recording`,
    name: input.track.title,
    url,
    image: absoluteUrl(input.track.image),
    byArtist: { "@type": "MusicGroup", "@id": ARTIST_ID, name: ARTIST_NAME },
    ...(description ? { description } : {}),
    ...(dateCreated ? { dateCreated } : {}),
    ...(input.track.permalink ? { sameAs: input.track.permalink } : {}),
    ...(typeof input.pricePence === "number"
      ? {
          offers: {
            "@type": "Offer",
            name: "Master MP3 download",
            price: formatGbp(input.pricePence),
            priceCurrency: "GBP",
            availability: "https://schema.org/InStock",
            url,
          },
        }
      : {}),
  };
}

/** Graph for a tablet page: the recording, its artist and Home › Track. */
export function tabletJsonLd(input: {
  track: RecordingInput;
  meaning?: string;
  pricePence?: number;
}): JsonLdNode[] {
  return [
    recordingJsonLd(input),
    artistJsonLd(),
    breadcrumbJsonLd([
      { name: SEO_SITE_NAME, url: HOME_URL },
      { name: input.track.title, url: tabletPageUrl({ tablet: input.track.slug }) },
    ]),
  ];
}

export function homeJsonLd(description: string): JsonLdNode[] {
  return [websiteJsonLd(description), artistJsonLd()];
}

export const EBOOK_CANONICAL = pageCanonical(EBOOK_PAGE_PATH);

export function bookJsonLd(): JsonLdNode {
  return {
    "@type": "Book",
    "@id": `${EBOOK_CANONICAL}#book`,
    name: EBOOK_TITLE,
    description: EBOOK_DESCRIPTION,
    url: EBOOK_CANONICAL,
    image: absoluteUrl(EBOOK_COVER.jpg),
    bookFormat: "https://schema.org/EBook",
    numberOfPages: EBOOK_PAGES,
    isAccessibleForFree: true,
    hasPart: EBOOK_CONTENTS.map((part) => ({ "@type": "CreativeWork", name: part.title })),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "GBP",
      availability: "https://schema.org/InStock",
      url: EBOOK_CANONICAL,
      seller: { "@id": ARTIST_ID },
    },
  };
}

export function ebookJsonLd(): JsonLdNode[] {
  return [
    bookJsonLd(),
    artistJsonLd(),
    breadcrumbJsonLd([
      { name: SEO_SITE_NAME, url: HOME_URL },
      { name: EBOOK_TITLE, url: EBOOK_CANONICAL },
    ]),
  ];
}

export function pageBreadcrumbJsonLd(name: string, path: string): JsonLdNode[] {
  return [
    breadcrumbJsonLd([
      { name: SEO_SITE_NAME, url: HOME_URL },
      { name, url: pageCanonical(path) },
    ]),
  ];
}

/** Utility pages (receipt redemption, sign-in): out of the index, links still followed. */
export const NOINDEX_META = { name: "robots", content: "noindex, follow" } as const;
