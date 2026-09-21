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

export function secondsUntilCredit(
  elapsed: number,
  threshold = 30,
): number {
  if (!Number.isFinite(elapsed)) return threshold;
  return Math.max(0, Math.ceil(threshold - elapsed));
}

/** Wall copy for the listen streak: write the day, then come back tomorrow. */
export function wallStreakCopy(input: {
  count: number;
  todayMarked: boolean;
  listeningDaily?: boolean;
  elapsed?: number;
  threshold?: number;
}): StreakCopy {
  if (input.todayMarked) {
    const count = Math.max(input.count, 1);
    const numeral = riteNumeral(count);
    const days = `${count} day${count === 1 ? "" : "s"} at the wall`;
    return {
      kicker: `Rite · ${numeral}`,
      detail: `${days}. Come back tomorrow.`,
    };
  }
  const remaining = secondsUntilCredit(
    input.elapsed ?? 0,
    input.threshold,
  );
  const ticking = Boolean(input.listeningDaily) && remaining > 0;
  if (input.count <= 0) {
    return {
      kicker: "The rite",
      detail: ticking
        ? `Listen thirty seconds. ${remaining}s to write the day.`
        : "Listen thirty seconds. Come back tomorrow.",
    };
  }
  const numeral = riteNumeral(input.count);
  return {
    kicker: `Rite · ${numeral}`,
    detail: ticking
      ? `${remaining}s to keep the days.`
      : "Listen thirty seconds to keep the days.",
  };
}
