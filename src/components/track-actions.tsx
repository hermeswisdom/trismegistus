import { useEffect, useState } from "react";
import { Check, Heart, Share2 } from "lucide-react";
import { setMyFavorite } from "@/lib/favorites";
import { isSignedInForSaves } from "@/lib/favorites-sync";
import { useHearts } from "@/lib/hearts";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMeaning, type Track } from "@/lib/rooms";
import { clipboardShareText, shareTabletAsDaily, tabletSharePayload } from "@/lib/share";
import { dailyTrackId } from "@/lib/daily-catalog";
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
  const { user, isPending } = useCurrentUserState();
  const signedIn = isSignedInForSaves({
    authEnabled,
    userId: user?.id,
    isDevFallback: user?.isDevFallback,
  });

  return (
    <button
      type="button"
      aria-label={liked ? "Remove from saved tablets" : "Save this tablet"}
      aria-pressed={liked}
      onClick={(e) => {
        e.stopPropagation();
        const next = toggle(id);
        if (signedIn && !isPending) {
          void setMyFavorite({ data: { trackId: id, liked: next } }).catch(
            () => {
              /* local heart still holds */
            },
          );
        }
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
  daily,
}: {
  track: Track;
  className?: string;
  daily?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const dailyId = dailyTrackId();
  const asDaily = daily ?? shareTabletAsDaily(track.id, dailyId);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  return (
    <button
      type="button"
      aria-label={copied ? "Link copied" : asDaily ? "Share the day" : "Share"}
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await shareTabletPage(track, { daily: asDaily });
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

export function ShareDayButton({
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
      data-share-day=""
      aria-label={copied ? "Link copied" : "Share the day"}
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await shareTabletPage(track, { daily: true });
        if (ok) setCopied(true);
      }}
      className={cn(
        "inline-flex h-11 w-fit items-center gap-2 bg-elevated px-5 text-xs font-medium tracking-[0.2em] text-fg uppercase transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96]",
        className,
      )}
    >
      {copied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
      {copied ? "Copied" : "Share the day"}
    </button>
  );
}

export async function shareUrl(
  url: string,
  title: string,
  text: string,
): Promise<boolean> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return false;
    }
  }
  const pasted = clipboardShareText({ title, text, url });
  try {
    await navigator.clipboard.writeText(pasted);
    return true;
  } catch {
    try {
      const field = document.createElement("textarea");
      field.value = pasted;
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

function shareOrigin(): string | undefined {
  return typeof window !== "undefined" ? window.location.origin : undefined;
}

export async function shareTrack(track: Track) {
  const payload = tabletSharePayload(track, {
    daily: shareTabletAsDaily(track.id, dailyTrackId()),
    origin: shareOrigin(),
    meaning: getMeaning(track.id),
  });
  return shareUrl(payload.url, payload.title, payload.text);
}

export async function shareTabletPage(
  track: Track,
  opts: { daily?: boolean; origin?: string } = {},
) {
  const payload = tabletSharePayload(track, {
    daily: opts.daily,
    origin: opts.origin ?? shareOrigin(),
    meaning: getMeaning(track.id),
  });
  return shareUrl(payload.url, payload.title, payload.text);
}
