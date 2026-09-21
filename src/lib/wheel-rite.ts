export const WHEEL_SEGMENTS = 12;
export const WHEEL_SLICE = 360 / WHEEL_SEGMENTS;
export const WHEEL_SPIN_MS = 4200;

const INTERACTIVE = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"]);

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
export function shouldAutoSpinOnEnter(alreadyEntered: boolean) {
  return !alreadyEntered;
}
