import { MessageSquare } from "lucide-react";
import { useMarkSheet } from "@/lib/mark-sheet";
import { useMarksFeed } from "@/lib/marks-feed";
import { cn } from "@/lib/utils";

export function MarkButton({
  trackId,
  className,
}: {
  trackId: string;
  className?: string;
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
        "relative flex size-11 shrink-0 items-center justify-center text-fg transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96]",
        className,
      )}
    >
      <MessageSquare className="size-4" />
      {count > 0 ? (
        <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-accent" />
      ) : null}
    </button>
  );
}
