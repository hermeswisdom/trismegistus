import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { addTrackMark, listTrackMarks, type TrackMark } from "@/lib/marks";
import { useMarksFeed } from "@/lib/marks-feed";
import { useMarkSheet } from "@/lib/mark-sheet";
import { markAuthorFromSession } from "@/lib/mark-name";
import { leftMarkCopy, markNameHint } from "@/lib/mark-copy";
import { usePlayBoard } from "@/lib/play-board";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { isSignedInForSaves } from "@/lib/favorites-sync";
import { getTrack } from "@/lib/rooms";
import { cn } from "@/lib/utils";
import { AccountNudge } from "@/components/account-nudge";

const NAME_KEY = "trismegistus-mark-name";

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function MarksSheet() {
  const trackId = useMarkSheet((s) => s.trackId);
  const close = useMarkSheet((s) => s.close);
  const setTrack = useMarksFeed((s) => s.setTrack);
  const track = trackId ? getTrack(trackId) : undefined;
  const user = useCurrentUser();
  const signedIn = isSignedInForSaves({
    authEnabled,
    userId: user?.id,
    isDevFallback: user?.isDevFallback,
  });
  const signedName = signedIn
    ? markAuthorFromSession({
        name: user?.displayName,
        email: user?.primaryEmail,
      })
    : "";
  const [marks, setMarks] = useState<TrackMark[]>([]);
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [left, setLeft] = useState(false);
  const [error, setError] = useState(false);
  const noteTabletMark = usePlayBoard((s) => s.noteTabletMark);

  useEffect(() => {
    if (signedName) {
      setAuthor(signedName.slice(0, 40));
      return;
    }
    try {
      setAuthor(localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      /* private mode */
    }
  }, [signedName]);

  useEffect(() => {
    if (!trackId) {
      setMarks([]);
      setBody("");
      setLeft(false);
      setError(false);
      return;
    }
    setLeft(false);
    setError(false);
    void listTrackMarks({ data: trackId })
      .then((rows) => {
        const next = rows ?? [];
        setMarks(next);
        setTrack(trackId, next);
      })
      .catch(() => setMarks([]));
  }, [trackId, setTrack]);

  useEffect(() => {
    if (!trackId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [trackId, close]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!trackId || sending) return;
    const nextAuthor = (signedName || author).trim();
    const nextBody = body.trim();
    if (!nextAuthor || !nextBody) return;
    setSending(true);
    setError(false);
    setLeft(false);
    if (!signedName) {
      try {
        localStorage.setItem(NAME_KEY, nextAuthor.slice(0, 40));
      } catch {
        /* private mode */
      }
    }
    try {
      const rows = await addTrackMark({
        data: { trackId, author: nextAuthor, body: nextBody },
      });
      setMarks(rows ?? []);
      if (trackId) setTrack(trackId, rows ?? []);
      setBody("");
      setLeft(true);
      noteTabletMark(trackId);
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-[opacity,visibility] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        trackId ? "visible opacity-100" : "invisible opacity-0 pointer-events-none",
      )}
    >
      <button
        type="button"
        aria-label="Close marks"
        onClick={close}
        className="absolute inset-0 bg-bg/70"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="marks-title"
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto border-t border-border bg-surface px-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-8",
          "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          trackId ? "translate-y-0" : "translate-y-6",
        )}
      >
        <div className="mx-auto max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs tracking-[0.28em] text-accent uppercase">
                A mark on the tablet
              </p>
              <h2
                id="marks-title"
                className="mt-2 truncate font-display text-2xl text-fg sm:text-3xl"
              >
                {track?.title ?? "Tablet"}
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="flex size-11 shrink-0 items-center justify-center text-muted transition-colors duration-150 hover:text-fg"
            >
              <X className="size-5" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
            <label className="block">
              <span className="mb-2 block text-xs tracking-[0.2em] text-subtle uppercase">
                {signedName ? "Your name (private)" : "Name"}
              </span>
              <input
                required={!signedName}
                maxLength={40}
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                readOnly={Boolean(signedName)}
                placeholder={signedName ? undefined : "A name for this tablet"}
                className="h-12 w-full border-0 border-b border-border bg-transparent px-0 text-base text-fg outline-none transition-[border-color] duration-150 placeholder:text-subtle focus:border-fg read-only:text-accent"
                autoComplete="nickname"
                suppressHydrationWarning
              />
            </label>
            <p className="text-xs leading-relaxed text-subtle">
              {markNameHint({ signedIn: Boolean(signedName), name: signedName || author })}
            </p>
            {authEnabled && !signedName ? (
              <AccountNudge forMarks className="mt-1" />
            ) : null}
            <label className="block">
              <span className="mb-2 block text-xs tracking-[0.2em] text-subtle uppercase">
                Comment
              </span>
              <textarea
                required
                maxLength={280}
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="A line for the tablet"
                className="w-full resize-none border-0 border-b border-border bg-transparent px-0 py-3 text-base text-fg outline-none transition-[border-color] duration-150 placeholder:text-subtle focus:border-fg"
                suppressHydrationWarning
              />
            </label>
            {left ? (
              <p
                data-mark-left=""
                className="text-sm leading-relaxed text-accent"
              >
                {leftMarkCopy({
                  signedIn: Boolean(signedName),
                  name: signedName || author,
                })}
              </p>
            ) : null}
            {error ? (
              <p className="text-sm leading-relaxed text-accent">
                The mark did not hold. Try again.
              </p>
            ) : null}
            <button
              type="submit"
              disabled={sending || !(signedName || author).trim() || !body.trim()}
              className="inline-flex h-12 w-fit items-center justify-center bg-accent px-8 text-xs font-medium tracking-[0.2em] text-bg uppercase transition-opacity duration-150 hover:opacity-90 active:scale-[0.96] disabled:opacity-60"
            >
              {sending ? "Leaving" : "Leave mark"}
            </button>
          </form>

          <ol className="mt-10 divide-y divide-border border-t border-border">
            {marks.length === 0 ? (
              <li className="py-8 text-sm text-muted">
                No marks yet. Leave the first.
              </li>
            ) : (
              marks.map((mark, index) => (
                <li
                  key={mark.id}
                  className={cn("py-5", left && index === 0 && "mark-pulse-in")}
                >
                  <p className="flex items-baseline justify-between gap-4">
                    <span className="font-display text-lg text-fg">
                      {mark.author}
                    </span>
                    <span className="text-xs tracking-[0.16em] text-subtle uppercase">
                      {formatWhen(mark.createdAt)}
                    </span>
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {mark.body}
                  </p>
                </li>
              ))
            )}
          </ol>
        </div>
      </div>
    </div>
  );
}
