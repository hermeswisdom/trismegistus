export const MARK_WINDOW_MS = 15 * 60 * 1000;
export const MARK_WINDOW_MAX = 12;
export const MARK_MIN_GAP_MS = 4000;

export type RateWindow = {
  windowStart: number;
  markCount: number;
  lastMarkAt: number;
};

export type RateDecision = {
  allowed: boolean;
  next: RateWindow;
  reason?: "gap" | "window";
};

export function evaluateMarkRate(
  current: RateWindow | null,
  now: number,
  opts: {
    windowMs?: number;
    max?: number;
    minGapMs?: number;
  } = {},
): RateDecision {
  const windowMs = opts.windowMs ?? MARK_WINDOW_MS;
  const max = opts.max ?? MARK_WINDOW_MAX;
  const minGapMs = opts.minGapMs ?? MARK_MIN_GAP_MS;

  if (!current) {
    return {
      allowed: true,
      next: { windowStart: now, markCount: 1, lastMarkAt: now },
    };
  }

  if (now - current.lastMarkAt < minGapMs) {
    return { allowed: false, next: current, reason: "gap" };
  }

  if (now - current.windowStart >= windowMs) {
    return {
      allowed: true,
      next: { windowStart: now, markCount: 1, lastMarkAt: now },
    };
  }

  if (current.markCount >= max) {
    return { allowed: false, next: current, reason: "window" };
  }

  return {
    allowed: true,
    next: {
      windowStart: current.windowStart,
      markCount: current.markCount + 1,
      lastMarkAt: now,
    },
  };
}
