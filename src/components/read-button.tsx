import { BookOpen } from "lucide-react";
import { useMeaningSheet } from "@/lib/meaning-sheet";
import { cn } from "@/lib/utils";

export function ReadButton({
  trackId,
  className,
}: {
  trackId: string;
  className?: string;
}) {
  const open = useMeaningSheet((s) => s.open);

  return (
    <button
      type="button"
      aria-label="Read the meaning"
      onClick={(e) => {
        e.stopPropagation();
        open(trackId);
      }}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center text-fg transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96]",
        className,
      )}
    >
      <BookOpen className="size-4" />
    </button>
  );
}
