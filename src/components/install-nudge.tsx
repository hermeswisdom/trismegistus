import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { usePlayer } from "@/lib/player-store";
import {
  bumpVisitCount,
  consumeInstallPrompt,
  looksLikeIos,
  peekInstallPrompt,
  readInstallDismissed,
  readStandaloneDisplay,
  readStoredFirstSpin,
  rememberInstallPrompt,
  shouldOfferInstall,
  writeInstallDismissed,
  type BeforeInstallPromptEvent,
} from "@/lib/install-prompt";
import { cn } from "@/lib/utils";

export function InstallNudge() {
  const entered = usePlayer((s) => s.entered);
  const [open, setOpen] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      rememberInstallPrompt(event as BeforeInstallPromptEvent);
      setCanPrompt(true);
    };
    const onInstalled = () => {
      writeInstallDismissed();
      rememberInstallPrompt(null);
      setOpen(false);
      setCanPrompt(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const visitsRef = useRef<number | null>(null);

  useEffect(() => {
    if (visitsRef.current == null) visitsRef.current = bumpVisitCount();
    const offer = shouldOfferInstall({
      dismissed: readInstallDismissed(),
      standalone: readStandaloneDisplay(),
      visitCount: visitsRef.current,
      firstSpinDone: readStoredFirstSpin(),
      entered,
    });
    if (!offer) return;

    const timer = window.setTimeout(() => {
      if (readInstallDismissed() || readStandaloneDisplay()) return;
      setCanPrompt(Boolean(peekInstallPrompt()));
      setOpen(true);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [entered]);

  function dismiss() {
    writeInstallDismissed();
    setOpen(false);
    setIosHint(false);
  }

  async function install() {
    const prompt = consumeInstallPrompt();
    if (prompt) {
      setCanPrompt(false);
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === "accepted") {
          writeInstallDismissed();
          setOpen(false);
          return;
        }
      } catch {
        rememberInstallPrompt(prompt);
        setCanPrompt(true);
      }
      return;
    }
    if (
      looksLikeIos(navigator.userAgent, navigator.maxTouchPoints ?? 0)
    ) {
      setIosHint(true);
      return;
    }
    setIosHint(true);
  }

  if (!open) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[45] flex justify-center px-4",
        "bottom-[calc(6.75rem+env(safe-area-inset-bottom))]",
      )}
    >
      <aside
        role="dialog"
        aria-labelledby="install-nudge-title"
        aria-describedby="install-nudge-copy"
        className="pointer-events-auto w-full max-w-md border border-border bg-surface/95 p-4 shadow-[0_0_0_1px_rgb(214_226_74_/_18%),0_18px_40px_rgb(0_0_0_/_45%)] backdrop-blur-md"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium tracking-[0.28em] text-accent uppercase">
            Keep the wall
          </p>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install hint"
            className="flex size-11 shrink-0 items-center justify-center text-muted transition-colors duration-150 hover:text-fg"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <h2
          id="install-nudge-title"
          className="mt-1 font-display text-xl text-fg"
        >
          Add Atman Music
        </h2>
        <p id="install-nudge-copy" className="mt-2 text-sm leading-relaxed text-muted">
          {iosHint
            ? looksLikeIos(navigator.userAgent, navigator.maxTouchPoints ?? 0)
              ? "Safari → Share → Add to Home Screen. The wall opens full-screen, no browser chrome."
              : "Browser menu → Install app / Add to Home Screen. Opens like an app on the next visit."
            : "Put the listening wall on the home screen. Full-screen, less chrome, same tablets."}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void install()}
            className="inline-flex h-11 min-h-11 items-center justify-center bg-accent px-5 text-xs font-medium tracking-[0.16em] text-bg uppercase transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.98]"
          >
            {canPrompt ? "Install" : "Add to Home Screen"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-11 items-center text-xs tracking-[0.16em] text-subtle uppercase transition-colors duration-150 hover:text-fg"
          >
            Not now
          </button>
        </div>
      </aside>
    </div>
  );
}
