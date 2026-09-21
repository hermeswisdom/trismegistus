export const FIRST_SPIN_KEY = "trismegistus-first-spin";

/**
 * Visit marker only. Enter always spins on a fresh page life unless the URL
 * already chose a tablet — a prior `localStorage` flag must not skip the rite.
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
