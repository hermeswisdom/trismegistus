/**
 * Mood lookup for share cards from `src/data/track-analysis.json`.
 * Import the JSON so Nitro/Vite bundle it into the OG function.
 */
import analysis from "../data/track-analysis.json" with { type: "json" };
import { isOgMood, type OgMood } from "./og-card.ts";

type AnalysisRow = { mood?: string };

const rows = analysis as Record<string, AnalysisRow>;

export function moodForSlug(slug: string): OgMood {
  const mood = rows[slug]?.mood;
  return isOgMood(mood) ? mood : "chill";
}
