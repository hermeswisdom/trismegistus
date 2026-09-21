export type RainBudgetInput = {
  width: number;
  height: number;
  compact: boolean;
  viewportWidth: number;
  playing?: boolean;
  reduceMotion?: boolean;
};

export type RainBudget = {
  cellW: number;
  columns: number;
  trail: number;
  shadowBlur: number;
  frameMs: number;
  noteBias: number;
  speed: number;
  simpleGlyphs: boolean;
  maxDpr: number;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Phone-safe rain. Narrow viewports get fewer columns, shorter trails,
 * no blur, and a capped frame rate so notes stay in the lockup instead
 * of flooding the wall.
 */
export function rainBudget(input: RainBudgetInput): RainBudget {
  const width = Math.max(0, input.width);
  const phone = input.viewportWidth < 480;
  const narrow = input.viewportWidth < 720;
  const compact = input.compact;
  const playing = Boolean(input.playing);

  const cellW = compact
    ? phone
      ? 11
      : narrow
        ? 9
        : 7
    : phone
      ? 28
      : narrow
        ? 22
        : 16;

  const cap = compact
    ? phone
      ? 5
      : narrow
        ? 7
        : 10
    : phone
      ? 9
      : narrow
        ? 12
        : 22;

  const columns = width <= 0 ? 0 : clamp(Math.floor(width / cellW), 3, cap);
  const trail = compact
    ? phone
      ? 4
      : 5
    : phone
      ? 7
      : narrow
        ? 9
        : 14;

  return {
    cellW,
    columns,
    trail,
    shadowBlur: phone || compact ? 0 : narrow ? 3 : 10,
    frameMs: phone ? 42 : narrow ? 33 : playing ? 22 : 28,
    noteBias: playing ? 0.48 : 0.32,
    speed: playing ? (phone ? 1.25 : 1.7) : phone ? 0.7 : 1,
    simpleGlyphs: phone || compact,
    maxDpr: phone ? 1.5 : 2,
  };
}

export function rainSpawnY(height: number, recycle: boolean) {
  if (recycle) return -24 - Math.random() * 80;
  return -Math.random() * Math.max(24, height * 0.55);
}

export function rainColumnFinished(y: number, trail: number, cellW: number, height: number) {
  return y - trail * cellW > height + cellW;
}
