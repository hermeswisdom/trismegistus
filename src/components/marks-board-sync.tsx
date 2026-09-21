import { useEffect } from "react";
import { getMarksBoard } from "@/lib/plays";
import { usePlayBoard } from "@/lib/play-board";

const PULSE_MS = 45_000;

export function MarksBoardSync() {
  const setBoard = usePlayBoard((s) => s.setBoard);

  useEffect(() => {
    let cancelled = false;
    async function pull() {
      try {
        const next = await getMarksBoard();
        if (!cancelled && next) setBoard(next.rows, next.recent);
      } catch {
        /* empty board until the first mark lands */
      }
    }
    void pull();
    const id = window.setInterval(pull, PULSE_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [setBoard]);

  return null;
}
