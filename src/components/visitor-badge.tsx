import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { subscribeVisitorCounts } from "@/lib/heartbeat-client";
import { onlineLabel, totalLabel, type VisitorCounts } from "@/lib/visitor-count";

/**
 * "● 3 listening now · 1,204 visitors". The tab's single heartbeat
 * (heartbeat-client.ts) pings every 90s while visible and never while hidden;
 * the badge hides whenever the count store is unavailable.
 */
export function VisitorBadge({ className }: { className?: string }) {
  const [counts, setCounts] = useState<VisitorCounts | null>(null);

  useEffect(() => subscribeVisitorCounts(setCounts), []);

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
