import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  HEARTBEAT_MS,
  HIDDEN_HEARTBEAT_MS,
  onlineLabel,
  parseCounts,
  readOrCreateVisitorId,
  totalLabel,
  type VisitorCounts,
} from "@/lib/visitor-count";
import { visitorHeartbeat } from "@/lib/visitors";

function browserStore(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * "● 3 listening now · 1,204 visitors". Sends an anonymous heartbeat every
 * ~20s (slower while the tab is hidden) and hides itself whenever the count
 * store is unavailable.
 */
export function VisitorBadge({ className }: { className?: string }) {
  const [counts, setCounts] = useState<VisitorCounts | null>(null);

  useEffect(() => {
    const id = readOrCreateVisitorId(browserStore());
    let cancelled = false;
    let inFlight = false;
    let failures = 0;
    let timer: number | undefined;

    const schedule = () => {
      window.clearTimeout(timer);
      if (cancelled) return;
      timer = window.setTimeout(beat, document.hidden ? HIDDEN_HEARTBEAT_MS : HEARTBEAT_MS);
    };

    async function beat() {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const next = parseCounts(await visitorHeartbeat({ data: { id } }));
        failures = 0;
        if (!cancelled) setCounts(next);
      } catch {
        // One network blip keeps the last reading; a second hides the badge.
        failures += 1;
        if (!cancelled && failures >= 2) setCounts(null);
      } finally {
        inFlight = false;
        schedule();
      }
    }

    const onVisibility = () => {
      if (document.hidden) schedule();
      else void beat();
    };

    void beat();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!counts) return null;
  const online = onlineLabel(counts.online);
  const total = totalLabel(counts.total);

  return (
    <p
      className={cn(
        "visitor-badge inline-flex max-w-full items-center gap-2 rounded-full border border-accent/35 bg-bg/75 px-3 py-1 text-[0.62rem] font-medium tracking-[0.16em] whitespace-nowrap text-fg uppercase shadow-[0_0_18px_rgb(214_226_74_/_16%)] backdrop-blur-md sm:px-3.5 sm:text-[0.68rem] sm:tracking-[0.2em]",
        className,
      )}
      aria-label={`${online}, ${total}`}
      data-testid="visitor-badge"
    >
      <span className="visitor-dot size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
      <span className="text-accent">{online}</span>
      <span className="text-subtle" aria-hidden="true">
        ·
      </span>
      <span className="text-muted">{total}</span>
    </p>
  );
}
