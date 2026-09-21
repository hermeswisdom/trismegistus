export const FIRST_SPIN_KEY = "trismegistus-first-spin";

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
