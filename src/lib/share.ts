import { SITE_ORIGIN, tabletPageUrl } from "./tablet-link.ts";

export const SITE_NAME = "Atman Music";

export type SharePayload = {
  title: string;
  text: string;
  url: string;
};

function firstVerseLine(meaning: string | undefined): string {
  const line = (meaning ?? "")
    .split("\n")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .find(Boolean);
  if (!line) return "";
  return line.length > 160 ? `${line.slice(0, 157).trimEnd()}…` : line;
}

/** Title, text, and wall URL for Web Share / clipboard. Brand is Atman Music. */
export function tabletSharePayload(
  track: { title: string; slug: string },
  opts: { daily?: boolean; origin?: string; meaning?: string } = {},
): SharePayload {
  const url = tabletPageUrl({
    daily: opts.daily,
    tablet: opts.daily ? undefined : track.slug,
    origin: opts.origin,
  });
  const verse = firstVerseLine(opts.meaning);
  if (opts.daily) {
    return {
      title: `Today's tablet — ${track.title} — Atman Music`,
      text: verse
        ? `Today's tablet on Atman Music: ${track.title}. ${verse}`
        : `Today's tablet on Atman Music: ${track.title}. Come back tomorrow.`,
      url,
    };
  }
  return {
    title: `${track.title} — Atman Music`,
    text: verse
      ? `${track.title} on Atman Music. ${verse}`
      : `Play ${track.title} on Atman Music.`,
    url,
  };
}

/** Clipboard fallback: title + URL so a paste still unfurls. */
export function clipboardShareText(payload: SharePayload): string {
  return `${payload.title}\n${payload.url}`;
}

export function homeOgCopy(input: {
  source: "daily" | "tablet" | "none";
  title: string;
  meaning: string;
}): { title: string; description: string } {
  const meaning = input.meaning.replace(/\s+/g, " ").trim();
  const description = (
    meaning || "Play a tablet. Read the verse. Leave a mark."
  ).slice(0, 180);
  if (input.source === "none") {
    return {
      title: SITE_NAME,
      description: "Play a tablet. Read the verse. Leave a mark.",
    };
  }
  if (input.source === "daily") {
    return {
      title: `Today's tablet — ${input.title} — ${SITE_NAME}`,
      description,
    };
  }
  return {
    title: `${input.title} — ${SITE_NAME}`,
    description,
  };
}

function originFrom(origin?: string): string {
  return (origin ?? SITE_ORIGIN).replace(/\/$/, "");
}

function absoluteAssetUrl(path: string, origin?: string): string {
  const root = originFrom(origin);
  return `${root}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Brand card on unmarked home; catalog cover on tablet / daily deep links. */
export function homeOgImage(input: {
  source: "daily" | "tablet" | "none";
  image: string;
  origin?: string;
}): string {
  if (input.source === "none") return absoluteAssetUrl("/og.jpg", input.origin);
  return absoluteAssetUrl(input.image, input.origin);
}

export function homeOgUrl(input: {
  source: "daily" | "tablet" | "none";
  slug: string;
  origin?: string;
}): string {
  const origin = originFrom(input.origin);
  if (input.source === "none") return `${origin}/`;
  const daily = input.source === "daily";
  return tabletPageUrl({
    daily,
    tablet: daily ? undefined : input.slug,
    origin,
  });
}

export type HomeOgCard = {
  title: string;
  description: string;
  url: string;
  image: string;
  imageAlt: string;
  siteName: typeof SITE_NAME;
};

export function homeOgCard(input: {
  source: "daily" | "tablet" | "none";
  title: string;
  meaning: string;
  image: string;
  slug: string;
  origin?: string;
}): HomeOgCard {
  const copy = homeOgCopy(input);
  return {
    ...copy,
    url: homeOgUrl(input),
    image: homeOgImage(input),
    imageAlt:
      input.source === "none" ? SITE_NAME : `${input.title} — ${SITE_NAME}`,
    siteName: SITE_NAME,
  };
}
