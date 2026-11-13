import { cn } from "@/lib/utils";

/** Circle 'A' mark used as the header / page-lockup logo. */
export function SiteMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/mark-192.png"
      alt="Atman Music"
      width={32}
      height={32}
      className={cn("site-mark size-7 sm:size-8", className)}
      decoding="async"
    />
  );
}
