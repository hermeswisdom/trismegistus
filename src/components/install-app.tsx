import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Share, X } from "lucide-react";
import {
  APP_NAME,
  clearStashedInstallPrompt,
  installMenuLabel,
  installPromptBody,
  installSheetCopy,
  readInstallEnvironment,
  readInstallGuide,
  serverInstallEnvironment,
  shouldShowInstallPrompt,
  stashedInstallState,
  subscribeInstallEnvironment,
  writeDismissedUntil,
  type BeforeInstallPromptEvent,
  type InstallGuide,
  type InstallStep,
} from "@/lib/install-app";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

type InstallAppContextValue = {
  isStandalone: boolean;
  canPrompt: boolean;
  promptVisible: boolean;
  ios: boolean;
  /**
   * The one install action for every trigger: the native Chromium prompt
   * when one is deferred, otherwise the platform instructions sheet. Pass
   * the trigger element so focus returns to it when the sheet closes.
   * Must be called synchronously inside the click (prompt() needs the gesture).
   */
  requestInstall: (trigger?: HTMLElement | null) => "prompt" | "sheet";
  dismissPrompt: () => void;
};

const FALLBACK: InstallAppContextValue = {
  isStandalone: false,
  canPrompt: false,
  promptVisible: false,
  ios: false,
  requestInstall: () => "sheet",
  dismissPrompt: () => {},
};

const InstallAppContext = createContext<InstallAppContextValue | null>(null);

/** Never throws during SSR or outside the provider. */
export function useInstallApp(): InstallAppContextValue {
  return useContext(InstallAppContext) ?? FALLBACK;
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function InstallAppProvider({ children }: { children: ReactNode }) {
  const env = useSyncExternalStore(subscribeInstallEnvironment, readInstallEnvironment, serverInstallEnvironment);
  const hydrated = useHydrated();
  // Start empty on every render pass (SSR and hydration agree); the effect
  // below picks up whatever the head script (INSTALL_CAPTURE_SCRIPT) stashed.
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [chromiumSettled, setChromiumSettled] = useState(false);
  const [dismissedHere, setDismissedHere] = useState(false);
  const [sheet, setSheet] = useState<{ guide: InstallGuide; trigger: HTMLElement | null } | null>(null);

  useEffect(() => {
    function onBeforeInstall(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setDeferred(null);
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    // Re-check the stash now that our own listeners are attached: an event
    // that fired after the first render but before this effect only reached
    // the head script, and would otherwise be lost until the next one.
    const stash = stashedInstallState(window, { deferred: null, installed: false });
    if (stash.installed) {
      setInstalled(true);
      setDeferred(null);
    } else if (stash.deferred) {
      const early = stash.deferred;
      setDeferred((current) => current ?? early);
    }
    const settle = window.setTimeout(() => setChromiumSettled(true), 450);
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const isStandalone = env.standalone || installed;

  const openSheet = useCallback(
    (trigger: HTMLElement | null) => setSheet({ guide: readInstallGuide(isStandalone), trigger }),
    [isStandalone],
  );

  const requestInstall = useCallback(
    (trigger?: HTMLElement | null): "prompt" | "sheet" => {
      const el = trigger ?? null;
      if (!deferred || isStandalone) {
        openSheet(el);
        return "sheet";
      }
      const event = deferred;
      // A deferred prompt can only be used once.
      setDeferred(null);
      clearStashedInstallPrompt(window);
      try {
        event
          .prompt()
          .then(() => event.userChoice.catch(() => undefined))
          .catch(() => openSheet(el));
      } catch {
        openSheet(el);
        return "sheet";
      }
      return "prompt";
    },
    [deferred, isStandalone, openSheet],
  );

  const dismissPrompt = useCallback(() => {
    writeDismissedUntil(safeStorage());
    setDismissedHere(true);
  }, []);

  const closeSheet = useCallback(() => setSheet(null), []);

  const promptVisible = shouldShowInstallPrompt({
    hydrated,
    standalone: isStandalone,
    dismissed: env.dismissed || dismissedHere,
    mobile: env.mobile,
    ios: env.ios,
    canPrompt: Boolean(deferred),
    chromiumSettled,
  });

  const value = useMemo<InstallAppContextValue>(
    () => ({
      isStandalone,
      canPrompt: Boolean(deferred),
      promptVisible,
      ios: env.ios,
      requestInstall,
      dismissPrompt,
    }),
    [isStandalone, deferred, promptVisible, env.ios, requestInstall, dismissPrompt],
  );

  return (
    <InstallAppContext.Provider value={value}>
      {children}
      {sheet ? <InstallSheet guide={sheet.guide} returnFocusTo={sheet.trigger} onClose={closeSheet} /> : null}
    </InstallAppContext.Provider>
  );
}

/**
 * "Install app" / "App installed" entry for the nav, the phone menu and the
 * footer. `onPrompt` runs when the native Chromium sheet opened instead of
 * ours (the phone menu closes itself then).
 */
export function InstallAppButton({
  className,
  onPrompt,
  testId,
}: {
  className?: string;
  onPrompt?: () => void;
  testId?: string;
}) {
  const { isStandalone, requestInstall } = useInstallApp();
  const hydrated = useHydrated();
  const standalone = hydrated && isStandalone;
  return (
    <button
      type="button"
      data-install-trigger={testId ?? ""}
      data-installed={standalone ? "true" : undefined}
      aria-haspopup="dialog"
      onClick={(event) => {
        if (requestInstall(event.currentTarget) === "prompt") onPrompt?.();
      }}
      className={className}
    >
      {installMenuLabel(standalone)}
    </button>
  );
}

/** Subtle, dismissible, in-flow prompt (lives in the footer: never over the wheel or the dock). */
export function InstallPrompt({ className }: { className?: string }) {
  const { promptVisible, canPrompt, ios, requestInstall, dismissPrompt } = useInstallApp();
  if (!promptVisible) return null;
  return (
    <aside
      data-install-prompt=""
      aria-label={`Install ${APP_NAME}`}
      className={cn("flex items-start gap-3 border border-border bg-surface/70 py-3 pr-1 pl-3", className)}
    >
      <img src="/icons/icon-192.png" alt="" width={40} height={40} className="mt-0.5 size-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-relaxed text-muted">{installPromptBody({ ios, canPrompt })}</p>
        <button
          type="button"
          data-install-trigger="prompt"
          aria-haspopup={canPrompt ? undefined : "dialog"}
          onClick={(event) => requestInstall(event.currentTarget)}
          className="-ml-0.5 inline-flex min-h-11 items-center gap-2 text-xs font-medium tracking-[0.2em] text-accent uppercase transition-opacity duration-150 hover:opacity-80"
        >
          {canPrompt ? "Install" : "Show me how"}
        </button>
      </div>
      <button
        type="button"
        onClick={dismissPrompt}
        aria-label="Not now: hide the install reminder"
        className="-mt-1 flex size-11 shrink-0 items-center justify-center text-subtle transition-colors duration-150 hover:text-fg"
      >
        <X className="size-4" />
      </button>
    </aside>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Install instructions as a bottom sheet (phones) / centred dialog (wider).
 * role=dialog + aria-modal, focus moves in and is trapped, Esc / close /
 * backdrop close it, focus returns to the trigger, the page does not scroll.
 */
function InstallSheet({
  guide,
  returnFocusTo,
  onClose,
}: {
  guide: InstallGuide;
  returnFocusTo: HTMLElement | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = returnFocusTo ?? (document.activeElement as HTMLElement | null);
    const html = document.documentElement;
    const body = document.body;
    const prev = { html: html.style.overflow, body: body.style.overflow };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      html.style.overflow = prev.html;
      body.style.overflow = prev.body;
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [returnFocusTo]);

  const copy = installSheetCopy(guide);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" data-install-sheet="">
      <div
        className="absolute inset-0 bg-bg/75"
        aria-hidden="true"
        data-install-backdrop=""
        onClick={() => onCloseRef.current()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-install-guide={guide.kind}
        className="relative flex max-h-[min(88dvh,40rem)] w-full max-w-md flex-col overflow-hidden border-t border-border bg-surface text-fg sm:border"
        style={{
          paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/icons/icon-192.png" alt="" width={44} height={44} className="size-11 shrink-0" />
            <div className="min-w-0">
              <p className="text-[0.65rem] tracking-[0.28em] text-accent uppercase">
                {guide.kind === "installed" ? "Installed" : "Install the app"}
              </p>
              <h2 id={titleId} className="mt-1 font-display text-xl leading-tight text-fg">
                {copy.title}
              </h2>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onCloseRef.current()}
            aria-label="Close install instructions"
            className="-mr-2 flex size-11 shrink-0 items-center justify-center text-muted transition-colors duration-150 hover:text-fg"
          >
            <X className="size-5" />
          </button>
        </div>

        <div id={bodyId} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pt-4 pb-2 text-sm leading-relaxed">
          <p className="text-fg">{copy.lead}</p>
          {copy.steps.length ? (
            <ol className="space-y-3">
              {copy.steps.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-7 shrink-0 items-center justify-center bg-accent text-xs font-semibold text-bg tabular-nums"
                  >
                    {index + 1}
                  </span>
                  <StepText step={step} />
                </li>
              ))}
            </ol>
          ) : null}
          {copy.copyLink ? <CopyLink /> : null}
          {copy.foot ? <p className="text-xs leading-relaxed text-subtle">{copy.foot}</p> : null}
        </div>

        <div className="px-5 pt-3">
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            className="inline-flex h-12 w-full items-center justify-center border border-border text-xs font-medium tracking-[0.2em] text-fg uppercase transition-colors duration-150 hover:border-accent hover:text-accent"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StepText({ step }: { step: InstallStep }) {
  const parts = step.text.split("{share}");
  return (
    <span className="min-w-0 pt-0.5 text-muted">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 ? (
            <Share
              role="img"
              aria-label="(the Share icon)"
              className="mx-0.5 inline-block size-[1.1em] -translate-y-px align-middle text-accent"
            />
          ) : null}
        </span>
      ))}
    </span>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through: some in-app WebViews block the async clipboard API.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** The page URL without QC / share-tracking noise, so a pasted link starts clean. */
function installLink(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("qc");
  url.hash = "";
  return url.toString();
}

function CopyLink() {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const url = installLink();
  return (
    <div className="space-y-2 border border-border bg-bg/60 p-3">
      <p className="font-mono text-xs leading-5 break-all text-fg select-all">{url}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={async () => setStatus((await copyText(url)) ? "copied" : "failed")}
          className="inline-flex h-11 items-center gap-2 bg-accent px-4 text-xs font-medium tracking-[0.18em] text-bg uppercase transition-opacity duration-150 hover:opacity-90"
        >
          {status === "copied" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          Copy link
        </button>
        <span role="status" aria-live="polite" className="text-xs text-subtle">
          {status === "copied" ? "Link copied" : status === "failed" ? "Couldn't copy. Press and hold the link to copy it." : ""}
        </span>
      </div>
    </div>
  );
}
