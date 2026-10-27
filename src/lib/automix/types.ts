export const MOODS = [
  "chill",
  "hype",
  "dark",
  "happy",
  "dreamy",
  "epic",
] as const;

export type Mood = (typeof MOODS)[number];

export function isMood(value: string | null | undefined): value is Mood {
  return Boolean(value && (MOODS as readonly string[]).includes(value));
}

/** One analysed stream, the fields Auto Mix actually mixes with. */
export type MixTrack = {
  slug: string;
  title: string;
  bpm: number;
  camelot: string | null;
  energy: number;
  duration: number;
  outroStart: number | null;
  outroBars: number | null;
  mood: Mood;
  secondaryMood: Mood | null;
};

export type Camelot = { n: number; letter: "A" | "B" };
