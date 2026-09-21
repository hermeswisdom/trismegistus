import { getTrack } from "@/lib/rooms";
import type { RecentMark } from "@/lib/plays";
import { cn } from "@/lib/utils";

export function MarksPulse({
  recent,
  compact = false,
}: {
  recent: RecentMark[];
  compact?: boolean;
}) {
  if (recent.length === 0) return null;
  const shown = recent.slice(0, compact ? 4 : 8);

  return (
    <div
      className={cn(
        "border border-border bg-elevated/30",
        compact ? "px-4 py-3" : "px-5 py-4",
      )}
    >
      <p className="text-[0.65rem] font-medium tracking-[0.28em] text-accent uppercase">
        The room
      </p>
      <ul className={cn("mt-3 space-y-2", !compact && "sm:columns-2 sm:space-y-0 sm:gap-x-8")}>
        {shown.map((mark, index) => {
          const track = getTrack(mark.trackId);
          if (!track) return null;
          return (
            <li
              key={`${mark.trackId}-${mark.createdAt}-${index}`}
              className={cn(
                "flex items-baseline gap-2 text-sm text-muted",
                !compact && "sm:mb-2",
                index === 0 && "mark-pulse-in",
              )}
            >
              <span
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full bg-accent",
                  index === 0 && "shadow-[0_0_10px_rgb(214_226_74_/_80%)]",
                )}
                aria-hidden="true"
              />
              <span className="min-w-0">
                A mark on{" "}
                <span className="font-display text-fg">{track.title}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
