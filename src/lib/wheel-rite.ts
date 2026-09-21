export const WHEEL_SEGMENTS = 12;
export const WHEEL_SLICE = 360 / WHEEL_SEGMENTS;
export const WHEEL_SPIN_MS = 4200;
export const WHEEL_SPIN_REDUCED_MS = 900;
export const WHEEL_EASING = "cubic-bezier(0.12, 0.7, 0.08, 1)";

const INTERACTIVE = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"]);

export type WheelSpinPlan = {
  from: number;
  to: number;
  duration: number;
  turns: number;
  winIndex: number;
};

export function landingRotation(
  currentAngle: number,
  winIndex: number,
  turns: number,
  segments = WHEEL_SEGMENTS,
) {
  const slice = 360 / segments;
  const base = Math.ceil(currentAngle / 360) * 360;
  const landing = ((segments - winIndex) % segments) * slice;
  return base + turns * 360 + landing;
}

export function pickSpinTurns(random = Math.random) {
  return 5 + Math.floor(random() * 3);
}

export function resolveSpinMs(reduced: boolean, override?: number) {
  if (typeof override === "number" && override >= 0) return override;
  if (typeof window !== "undefined" && typeof window.__ATMAN_SPIN_MS === "number") {
    return window.__ATMAN_SPIN_MS;
  }
  return reduced ? WHEEL_SPIN_REDUCED_MS : WHEEL_SPIN_MS;
}

export function planWheelSpin(
  currentAngle: number,
  winIndex: number,
  opts: { reduced?: boolean; random?: () => number; durationMs?: number } = {},
): WheelSpinPlan {
  const turns = opts.reduced ? 1 : pickSpinTurns(opts.random);
  const duration = resolveSpinMs(Boolean(opts.reduced), opts.durationMs);
  const from = currentAngle;
  const to = landingRotation(currentAngle, winIndex, turns);
  return { from, to, duration, turns, winIndex };
}

export function wheelTransform(deg: number) {
  return `translate3d(0,0,0) rotate(${deg}deg)`;
}

export function shuffleTracks<T>(list: T[], random = Math.random) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const hold = next[i]!;
    next[i] = next[j]!;
    next[j] = hold;
  }
  return next;
}

export function buildWheelSegments<T extends { id: string }>(
  winner: T,
  catalog: readonly T[],
  opts: { random?: () => number; segments?: number } = {},
) {
  const count = opts.segments ?? WHEEL_SEGMENTS;
  const random = opts.random ?? Math.random;
  const pool = shuffleTracks(
    catalog.filter((track) => track.id !== winner.id),
    random,
  );
  const winIndex = Math.floor(random() * count);
  const rest = pool.slice(0, Math.max(0, count - 1));
  rest.splice(winIndex, 0, winner);
  return { segments: rest, winIndex };
}

/**
 * Rotate the disc with the Web Animations API. iOS Safari often skips a CSS
 * `transition` that is toggled in the same frame as `transform`.
 */
export function runWheelSpin(
  el: HTMLElement,
  plan: Pick<WheelSpinPlan, "from" | "to" | "duration">,
): { done: Promise<void>; cancel: () => void } {
  const from = wheelTransform(plan.from);
  const to = wheelTransform(plan.to);
  el.style.transform = from;

  if (typeof el.animate !== "function" || plan.duration <= 0) {
    el.style.transition = "none";
    el.style.transform = to;
    return { done: Promise.resolve(), cancel() {} };
  }

  const anim = el.animate([{ transform: from }, { transform: to }], {
    duration: plan.duration,
    easing: WHEEL_EASING,
    fill: "forwards",
    iterations: 1,
  });

  let settled = false;
  let watchdog = 0;
  const finish = () => {
    if (settled) return;
    settled = true;
    if (watchdog) window.clearTimeout(watchdog);
    try {
      anim.commitStyles();
    } catch {
      /* Safari < 13 */
    }
    try {
      anim.cancel();
    } catch {
      /* already finished */
    }
    el.style.transform = to;
  };

  const done = Promise.race([
    anim.finished.then(finish).catch(finish),
    new Promise<void>((resolve) => {
      watchdog = window.setTimeout(() => {
        finish();
        resolve();
      }, plan.duration + 120);
    }),
  ]).then(() => undefined);

  return {
    done,
    cancel() {
      settled = true;
      if (watchdog) window.clearTimeout(watchdog);
      try {
        anim.cancel();
      } catch {
        /* ignore */
      }
    },
  };
}

type KeyTarget = {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
};

export function isRiteKey(
  key: string,
  target: EventTarget | KeyTarget | null | undefined,
): boolean {
  if (key !== "Enter" && key !== " ") return false;
  const el = target as KeyTarget | null | undefined;
  if (!el?.tagName) return true;
  if (el.isContentEditable) return false;
  if (INTERACTIVE.has(el.tagName)) return false;
  if (
    typeof el.closest === "function" &&
    el.closest("input, textarea, select, button, a, [contenteditable='true']")
  ) {
    return false;
  }
  return true;
}

/** First crossing of the wall this page life — the Enter spin rite. */
export function shouldAutoSpinOnEnter(
  alreadyEntered: boolean,
  hasDeepLink = false,
) {
  return !alreadyEntered && !hasDeepLink;
}
