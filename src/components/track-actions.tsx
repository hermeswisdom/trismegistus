import { useEffect, useState } from "react";
import { Check, Heart, Share2 } from "lucide-react";
import { useHearts } from "@/lib/hearts";
import type { Track } from "@/lib/rooms";
import { cn } from "@/lib/utils";

const swap =
  "absolute inset-0 size-4 transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]";

export function HeartButton({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const liked = useHearts((s) => Boolean(s.ids[id]));
  const toggle = useHearts((s) => s.toggle);

  return (
    <button
      type="button"
      aria-label={liked ? "Unlike" : "Like"}
      aria-pressed={liked}
      onClick={(e) => {
        e.stopPropagation();
        toggle(id);
      }}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center text-fg transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96]",
        className,
      )}
    >
      <span className="relative size-4">
        <Heart
          className={cn(
            swap,
            liked
              ? "scale-100 fill-current text-accent opacity-100 blur-none"
              : "scale-[0.25] opacity-0 blur-[4px]",
          )}
        />
        <Heart
          className={cn(
            "size-4 transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
            liked
              ? "scale-[0.25] opacity-0 blur-[4px]"
              : "scale-100 opacity-100 blur-none",
          )}
        />
      </span>
    </button>
  );
}

export function ShareButton({
  track,
  className,
}: {
  track: Track;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  return (
    <button
      type="button"
      aria-label={copied ? "Link copied" : "Share"}
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await shareTrack(track);
        if (ok) setCopied(true);
      }}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center text-fg transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96]",
        className,
      )}
    >
      <span className="relative size-4">
        <Check
          className={cn(
            swap,
            copied
              ? "scale-100 text-accent opacity-100 blur-none"
              : "scale-[0.25] opacity-0 blur-[4px]",
          )}
        />
        <Share2
          className={cn(
            "size-4 transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
            copied
              ? "scale-[0.25] opacity-0 blur-[4px]"
              : "scale-100 opacity-100 blur-none",
          )}
        />
      </span>
    </button>
  );
}

export async function shareTrack(track: Track) {
  const url = track.permalink;
  const title = `${track.title} — Trismegistus`;
  const text = `${track.title} · Esoteric Vibrations`;
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return false;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    try {
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.top = "0";
      field.style.left = "0";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const ok = document.execCommand("copy");
      field.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
