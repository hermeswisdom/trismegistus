/** Marks-board polling cadence (visible tabs only). */
export const BOARD_PULSE_MS = 45_000;

/**
 * Should the board poll right now? Never while the tab is hidden; when it is
 * visible, only if the last successful-or-attempted poll is at least
 * `intervalMs` old (or there has been none).
 */
export function shouldPollBoard(opts: {
  hidden: boolean;
  lastPollAt: number | null;
  now: number;
  intervalMs?: number;
}): boolean {
  if (opts.hidden) return false;
  if (opts.lastPollAt == null) return true;
  return opts.now - opts.lastPollAt >= (opts.intervalMs ?? BOARD_PULSE_MS);
}
