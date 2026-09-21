import { MessageSquare } from "lucide-react";
import { useMarkSheet } from "@/lib/mark-sheet";
import { useMarksFeed } from "@/lib/marks-feed";
import { cn } from "@/lib/utils";

export function MarkButton({
  trackId,
  className,
  labeled = false,
}: {
  trackId: string;
  className?: string;
  labeled?: boolean;
}) {
  const open = useMarkSheet((s) => s.open);
  const count = useMarksFeed((s) => s.byTrack[trackId]?.length ?? 0);

  return (
    <button
      type="button"
      aria-label={count ? `${count} marks` : "Leave a mark"}
      onClick={(e) => {
        e.stopPropagation();
        open(trackId);
      }}
      className={cn(
        "relative shrink-0 text-fg transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96]",
        labeled
          ? "inline-flex h-12 w-fit items-center gap-2 px-5 text-xs font-medium tracking-[0.2em] uppercase"
          : "flex size-11 items-center justify-center",
        className,
      )}
    >
      <MessageSquare className="size-4" />
      {labeled ? <span>Leave a mark</span> : null}
      {count > 0 ? (
        <span
          className={cn(
            "absolute rounded-full bg-accent",
            labeled ? "top-2 right-2 size-1.5" : "top-1.5 right-1.5 size-1.5",
          )}
        />
      ) : null}
    </button>
  );
}
