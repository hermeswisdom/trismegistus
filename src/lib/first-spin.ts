export const FIRST_SPIN_KEY = "trismegistus-first-spin";

/**
 * First-visit marker. Enter spins once so the axle is never empty. A later
 * visit resumes the last tablet (see resolveEnterIntent) unless the URL
 * already chose one.
 */
export function shouldRunFirstSpin(input: {
  alreadyDone: boolean;
  hasDeepLink: boolean;
}): boolean {
  return !input.alreadyDone && !input.hasDeepLink;
}

export function readFirstSpinDone(): boolean {
  try {
    return localStorage.getItem(FIRST_SPIN_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeFirstSpinDone(): void {
  try {
    localStorage.setItem(FIRST_SPIN_KEY, "1");
  } catch {
    /* private mode */
  }
}

export type AutoFirstSpin = "wait" | "show-current" | "skip" | "spin";

/**
 * What the wheel does the first time the page is entered.
 * - deep link, or Enter already resumed a tablet: show that tablet, no spin
 *   (spinning would pause the resumed tablet and replay it outside the tap)
 * - a spin already began (Enter's first-visit spin): nothing to add
 * - otherwise spin once so the axle is never empty
 */
export function autoFirstSpin(input: {
  entered: boolean;
  alreadyHandled: boolean;
  hasDeepLink: boolean;
  resumedOnEnter: boolean;
  spinStarted: boolean;
}): AutoFirstSpin {
  if (!input.entered || input.alreadyHandled) return "wait";
  if (input.hasDeepLink || input.resumedOnEnter) return "show-current";
  if (input.spinStarted) return "skip";
  return "spin";
}
