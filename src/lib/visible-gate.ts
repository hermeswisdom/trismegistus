/**
 * Background-tab policy for server writes (POST server functions).
 *
 * Nothing POSTs while `document.hidden`, with one exception: the play record
 * for a tablet that really starts while the tab is hidden (auto-advance on a
 * locked phone, a lock-screen "next"). That listen keeps counting.
 *
 * Everything else that could fire in a background tab (signed-in last-tablet
 * save on auto-advance, the favorites merge in a tab opened in the
 * background, a marks list load) is deferred here and runs once the tab is
 * visible again. One job per key: a later call replaces the queued one, so
 * five auto-advances while locked become one save of the latest tablet.
 *
 * The visitor heartbeat keeps its own visible-only timer (heartbeat-client).
 * User-tap writes (hearts, marks, signals, checkout) only happen while visible.
 */

/** May this kind of POST leave a hidden tab? Only a real play record. */
export function mayPostWhileHidden(kind: "play" | "deferred"): boolean {
  return kind === "play";
}

type VisibilityDoc = {
  readonly hidden: boolean;
  addEventListener(type: "visibilitychange", fn: () => void): void;
  removeEventListener(type: "visibilitychange", fn: () => void): void;
};

export type VisibleGate = {
  /** Run `job` now if visible, else once visible (latest per key). */
  run(key: string, job: () => void): void;
  /** Drop a queued job (e.g. an unmounted effect). */
  cancel(key: string): void;
  /** Keys waiting for the tab to be visible. */
  pending(): string[];
};

export function createVisibleGate(doc: VisibilityDoc): VisibleGate {
  const queue = new Map<string, () => void>();
  let listening = false;

  const flush = () => {
    if (doc.hidden || queue.size === 0) return;
    const jobs = [...queue.values()];
    queue.clear();
    doc.removeEventListener("visibilitychange", flush);
    listening = false;
    for (const job of jobs) {
      try {
        job();
      } catch {
        /* one failed job never blocks the others */
      }
    }
  };

  return {
    run(key, job) {
      if (!doc.hidden) {
        queue.delete(key);
        job();
        return;
      }
      queue.set(key, job);
      if (!listening) {
        listening = true;
        doc.addEventListener("visibilitychange", flush);
      }
    },
    cancel(key) {
      queue.delete(key);
    },
    pending() {
      return [...queue.keys()];
    },
  };
}

let browserGate: VisibleGate | null = null;

/** The page's gate (browser only; on the server a job just runs). */
export function whenVisible(key: string, job: () => void): void {
  if (typeof document === "undefined") {
    job();
    return;
  }
  browserGate ??= createVisibleGate(document);
  browserGate.run(key, job);
}

export function cancelWhenVisible(key: string): void {
  browserGate?.cancel(key);
}
