import { FIRST_SPIN_KEY } from "./first-spin.ts";

export const INSTALL_DISMISS_KEY = "trismegistus-install-dismissed";
export const INSTALL_VISIT_KEY = "trismegistus-install-visits";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function isStandaloneDisplay(input: {
  displayStandalone?: boolean;
  displayFullscreen?: boolean;
  safariStandalone?: boolean;
}): boolean {
  return Boolean(
    input.displayStandalone || input.displayFullscreen || input.safariStandalone,
  );
}

export function readStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return isStandaloneDisplay({
    displayStandalone: window.matchMedia("(display-mode: standalone)").matches,
    displayFullscreen: window.matchMedia("(display-mode: fullscreen)").matches,
    safariStandalone: Boolean(
      (navigator as Navigator & { standalone?: boolean }).standalone,
    ),
  });
}

export function shouldOfferInstall(input: {
  dismissed: boolean;
  standalone: boolean;
  visitCount: number;
  firstSpinDone: boolean;
  entered: boolean;
}): boolean {
  if (input.dismissed || input.standalone) return false;
  return input.visitCount >= 2 || input.firstSpinDone || input.entered;
}

export function readInstallDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeInstallDismissed(): void {
  try {
    localStorage.setItem(INSTALL_DISMISS_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function readVisitCount(): number {
  try {
    const raw = Number.parseInt(localStorage.getItem(INSTALL_VISIT_KEY) ?? "0", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch {
    return 0;
  }
}

export function bumpVisitCount(): number {
  const next = readVisitCount() + 1;
  try {
    localStorage.setItem(INSTALL_VISIT_KEY, String(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function readStoredFirstSpin(): boolean {
  try {
    return localStorage.getItem(FIRST_SPIN_KEY) === "1";
  } catch {
    return false;
  }
}

export function looksLikeIos(ua: string, maxTouchPoints = 0): boolean {
  const text = ua.toLowerCase();
  if (/iphone|ipod|ipad/.test(text)) return true;
  return text.includes("macintosh") && maxTouchPoints > 1;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function rememberInstallPrompt(event: BeforeInstallPromptEvent | null): void {
  deferredPrompt = event;
}

export function peekInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function consumeInstallPrompt(): BeforeInstallPromptEvent | null {
  const event = deferredPrompt;
  deferredPrompt = null;
  return event;
}
