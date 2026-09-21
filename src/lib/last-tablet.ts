export const LAST_TABLET_KEY = "trismegistus-last-tablet";

export function parseLastTablet(
  raw: string | null | undefined,
  known?: ReadonlySet<string>,
): string | null {
  const id = raw?.trim() ?? "";
  if (!id || id.length > 80) return null;
  if (known && !known.has(id)) return null;
  return id;
}

export function readLastTablet(known?: ReadonlySet<string>): string | null {
  try {
    return parseLastTablet(localStorage.getItem(LAST_TABLET_KEY), known);
  } catch {
    return null;
  }
}

export function writeLastTablet(trackId: string, known?: ReadonlySet<string>): void {
  const id = parseLastTablet(trackId, known);
  if (!id) return;
  try {
    localStorage.setItem(LAST_TABLET_KEY, id);
  } catch {
    /* private mode */
  }
}

/** First visit spins. Returning visitors play the last tablet when we have one. */
export function resolveEnterIntent(input: {
  alreadyEntered: boolean;
  hasDeepLink: boolean;
  firstSpinDone: boolean;
  lastTrackId?: string | null;
}): "spin" | "play" {
  if (input.alreadyEntered) return "play";
  if (input.hasDeepLink) return "play";
  if (!input.firstSpinDone) return "spin";
  if (parseLastTablet(input.lastTrackId ?? null)) return "play";
  return "spin";
}
