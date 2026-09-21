import { tabletPageUrl } from "./tablet-link.ts";

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
      title: "Atman Music",
      description: "Play a tablet. Read the verse. Leave a mark.",
    };
  }
  if (input.source === "daily") {
    return {
      title: `Today's tablet — ${input.title} — Atman Music`,
      description,
    };
  }
  return {
    title: `${input.title} — Atman Music`,
    description,
  };
}
