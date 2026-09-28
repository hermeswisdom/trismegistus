import { useEffect } from "react";
import { BOARD_PULSE_MS, shouldPollBoard } from "@/lib/board-poll";
import { getMarksBoard } from "@/lib/plays";
import { usePlayBoard } from "@/lib/play-board";

/**
 * Keeps the marks board fresh: polls every 45s while the tab is visible,
 * pauses while it is hidden, and catches up once on return if the last poll
 * is stale.
 */
export function MarksBoardSync() {
  const setBoard = usePlayBoard((s) => s.setBoard);

  useEffect(() => {
    let cancelled = false;
    let lastPollAt: number | null = null;
    let timer: number | undefined;

    const schedule = () => {
      window.clearTimeout(timer);
      if (cancelled || document.hidden) return;
      const wait =
        lastPollAt == null
          ? 0
          : Math.max(0, BOARD_PULSE_MS - (Date.now() - lastPollAt));
      timer = window.setTimeout(tick, wait);
    };

    async function tick() {
      if (cancelled) return;
      if (
        !shouldPollBoard({ hidden: document.hidden, lastPollAt, now: Date.now() })
      ) {
        schedule();
        return;
      }
      lastPollAt = Date.now();
      try {
        const next = await getMarksBoard();
        if (!cancelled && next) setBoard(next.rows, next.recent);
      } catch {
        /* empty board until the first mark lands */
      }
      schedule();
    }

    const onVisibility = () => {
      if (document.hidden) window.clearTimeout(timer);
      else schedule();
    };

    // First pull now if visible; a background tab waits until it is shown.
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [setBoard]);

  return null;
}
