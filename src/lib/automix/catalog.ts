import analysis from "../../data/track-analysis.json";
import { hasStream } from "../streams.ts";
import { isMood, type MixTrack } from "./types.ts";

type AnalysisRow = {
  title: string;
  bpm: number;
  camelot: string | null;
  energy: number;
  duration: number;
  outroStart: number | null;
  outroBars: number | null;
  mood: string;
  secondaryMood: string | null;
};

let cached: MixTrack[] | null = null;

/**
 * Analysed streams only. Tablets without a native stream stay out of Auto Mix
 * (they would need the SoundCloud widget, which this engine does not use).
 */
export function automixCatalog(): MixTrack[] {
  if (cached) return cached;
  const rows: MixTrack[] = [];
  for (const [slug, raw] of Object.entries(analysis as Record<string, AnalysisRow>)) {
    if (!hasStream(slug) || !isMood(raw.mood)) continue;
    rows.push({
      slug,
      title: raw.title,
      bpm: raw.bpm,
      camelot: raw.camelot,
      energy: raw.energy,
      duration: raw.duration,
      outroStart: raw.outroStart,
      outroBars: raw.outroBars,
      mood: raw.mood,
      secondaryMood: isMood(raw.secondaryMood) ? raw.secondaryMood : null,
    });
  }
  cached = rows;
  return rows;
}
