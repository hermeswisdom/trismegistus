const GLYPHS = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
];

export function riteNumeral(n: number): string {
  if (n <= 0) return "";
  return GLYPHS[n - 1] ?? String(n);
}

export type StreakCopy = {
  kicker: string;
  detail: string;
};

/** Wall copy for the listen streak: write the day, then come back tomorrow. */
export function wallStreakCopy(input: {
  count: number;
  todayMarked: boolean;
}): StreakCopy {
  if (input.count <= 0) {
    return {
      kicker: "The rite",
      detail: "Listen thirty seconds. Come back tomorrow.",
    };
  }
  const numeral = riteNumeral(input.count);
  const days = `${input.count} day${input.count === 1 ? "" : "s"} at the wall`;
  if (input.todayMarked) {
    return {
      kicker: `Rite · ${numeral}`,
      detail: `${days}. Come back tomorrow.`,
    };
  }
  return {
    kicker: `Rite · ${numeral}`,
    detail: "Listen thirty seconds to keep the days.",
  };
}
