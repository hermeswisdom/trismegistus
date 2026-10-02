/**
 * "Install app" for Atman Music, ported from Watchtower (#58 sheet + platform
 * steps, #61 early `beforeinstallprompt` capture + installed label).
 *
 * No service worker and no offline cache: this is only the manifest-driven
 * home-screen install. Pure helpers live here so `node --test` can cover them;
 * the React half is src/components/install-app.tsx.
 */

/** Chromium `beforeinstallprompt` is not in the standard TypeScript DOM lib. */
export type BeforeInstallPromptEvent = Event & {
  readonly platforms?: ReadonlyArray<string>;
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export const APP_NAME = "Atman Music";

export const INSTALL_DISMISS_KEY = "atman.install-prompt.dismissed-until";
/** Quiet the footer prompt after "Not now"; the nav / menu entry still works. */
export const INSTALL_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

/** `window` keys the head script uses to hand early events to the provider. */
export const INSTALL_PROMPT_STASH_KEY = "__atmanInstallPrompt";
export const APP_INSTALLED_STASH_KEY = "__atmanAppInstalled";

/**
 * Inline <head> script, runs before hydration. Chromium can fire
 * `beforeinstallprompt` before React mounts the provider; without this the
 * event is missed (and Chrome shows its own mini-infobar). Defer it and keep
 * it on `window` for the provider to pick up.
 */
export const INSTALL_CAPTURE_SCRIPT = `(function(){try{var w=window;w.addEventListener("beforeinstallprompt",function(e){e.preventDefault();w[${JSON.stringify(
  INSTALL_PROMPT_STASH_KEY,
)}]=e;});w.addEventListener("appinstalled",function(){w[${JSON.stringify(INSTALL_PROMPT_STASH_KEY)}]=null;w[${JSON.stringify(
  APP_INSTALLED_STASH_KEY,
)}]=true;});}catch(e){}})();`;

type InstallStash = {
  [INSTALL_PROMPT_STASH_KEY]?: BeforeInstallPromptEvent | null;
  [APP_INSTALLED_STASH_KEY]?: boolean;
};

/** The deferred prompt captured by the head script, if any (left in place until used). */
export function readStashedInstallPrompt(win: object): BeforeInstallPromptEvent | null {
  return (win as InstallStash)[INSTALL_PROMPT_STASH_KEY] ?? null;
}

/** True if `appinstalled` fired (possibly before the provider mounted). */
export function readStashedAppInstalled(win: object): boolean {
  return (win as InstallStash)[APP_INSTALLED_STASH_KEY] === true;
}

/** A deferred prompt can only be used once: forget it after `prompt()`. */
export function clearStashedInstallPrompt(win: object): void {
  (win as InstallStash)[INSTALL_PROMPT_STASH_KEY] = null;
}

/**
 * What the provider should hold after (re-)reading the stash. Called on mount
 * AND inside the listener effect, because `beforeinstallprompt` can fire
 * between the first render and the effect attaching the provider's own
 * listener; only the head script sees it then.
 */
export function stashedInstallState(
  win: object,
  current: { deferred: BeforeInstallPromptEvent | null; installed: boolean },
): { deferred: BeforeInstallPromptEvent | null; installed: boolean } {
  const installed = current.installed || readStashedAppInstalled(win);
  if (installed) return { deferred: null, installed: true };
  return { deferred: current.deferred ?? readStashedInstallPrompt(win), installed: false };
}

/** Nav / menu label: in the installed app it reads "App installed" (and opens the installed sheet). */
export function installMenuLabel(isStandalone: boolean): "Install app" | "App installed" {
  return isStandalone ? "App installed" : "Install app";
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export type InstallEnvironment = {
  standalone: boolean;
  ios: boolean;
  mobile: boolean;
  dismissed: boolean;
};

/**
 * Installed-app display modes. Not `fullscreen`: Chromium matches it for an
 * F11 / video fullscreen browser tab too, which is not "installed".
 */
const STANDALONE_QUERIES = ["(display-mode: standalone)", "(display-mode: window-controls-overlay)"];

export function isStandaloneDisplay(
  standaloneFlag: boolean | undefined,
  matchMedia: ((query: string) => { matches: boolean }) | undefined,
): boolean {
  if (standaloneFlag === true) return true;
  if (!matchMedia) return false;
  return STANDALONE_QUERIES.some((query) => matchMedia(query).matches);
}

/**
 * Every iOS / iPadOS browser uses WebKit and never fires `beforeinstallprompt`.
 */
export function isIosWebKit(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  // iPadOS 13+ Safari reports as Macintosh with a touch screen.
  if (platform === "MacIntel" && maxTouchPoints > 1) return true;
  return false;
}

export function isLikelyMobile(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || isIosWebKit(userAgent, platform, maxTouchPoints);
}

export function readDismissedUntil(storage: Pick<Storage, "getItem"> | null, now = Date.now()): boolean {
  try {
    const raw = storage?.getItem(INSTALL_DISMISS_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && until > now;
  } catch {
    return false;
  }
}

/** React 19 `useSyncExternalStore` needs a stable snapshot object while nothing changed. */
let cachedClientSnapshot: InstallEnvironment | null = null;

export function writeDismissedUntil(storage: Pick<Storage, "setItem"> | null, now = Date.now()): void {
  try {
    storage?.setItem(INSTALL_DISMISS_KEY, String(now + INSTALL_DISMISS_MS));
  } catch {
    // Ignore quota / private-mode failures; the in-memory dismiss still holds.
  }
  cachedClientSnapshot = null;
}

export function navigatorStandalone(nav: Navigator): boolean | undefined {
  return (nav as Navigator & { standalone?: boolean }).standalone;
}

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readInstallEnvironment(): InstallEnvironment {
  const nav = window.navigator;
  const next: InstallEnvironment = {
    standalone: isStandaloneDisplay(navigatorStandalone(nav), (query) => window.matchMedia(query)),
    ios: isIosWebKit(nav.userAgent, nav.platform, nav.maxTouchPoints),
    mobile: isLikelyMobile(nav.userAgent, nav.platform, nav.maxTouchPoints),
    dismissed: readDismissedUntil(safeLocalStorage()),
  };
  const prev = cachedClientSnapshot;
  if (
    prev &&
    prev.standalone === next.standalone &&
    prev.ios === next.ios &&
    prev.mobile === next.mobile &&
    prev.dismissed === next.dismissed
  ) {
    return prev;
  }
  cachedClientSnapshot = next;
  return next;
}

/** Server / hydration snapshot: nothing install-related shows until the client knows. */
const SERVER_INSTALL_ENVIRONMENT: InstallEnvironment = {
  standalone: false,
  ios: false,
  mobile: false,
  dismissed: true,
};

export function serverInstallEnvironment(): InstallEnvironment {
  return SERVER_INSTALL_ENVIRONMENT;
}

export function subscribeInstallEnvironment(onStoreChange: () => void): () => void {
  const queries = STANDALONE_QUERIES.map((query) => window.matchMedia(query));
  for (const query of queries) query.addEventListener("change", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    for (const query of queries) query.removeEventListener("change", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

// ---------------------------------------------------------------------------
// Which instructions to show
// ---------------------------------------------------------------------------

export type InstallGuideKind =
  | "installed"
  | "ios-safari"
  | "ios-other-browser"
  | "ios-in-app"
  | "android"
  | "android-in-app"
  | "desktop-chrome"
  | "desktop-edge"
  | "desktop-safari"
  | "desktop-firefox"
  | "desktop-other";

export type InstallGuide = {
  kind: InstallGuideKind;
  /** Host app (in-app browsers) or browser (iOS other browser), when the user agent names it. */
  app: string | null;
};

/**
 * In-app browser user-agent tokens, most specific first (Messenger and
 * Instagram UAs also carry Facebook tokens).
 */
const IN_APP_BROWSERS: ReadonlyArray<{ app: string; pattern: RegExp }> = [
  { app: "Messenger", pattern: /FBAN\/Messenger|MessengerForiOS|FB_IAB\/MESSENGER|FBAN\/MessengerLite|Orca-Android/i },
  { app: "Instagram", pattern: /Instagram/i },
  { app: "Facebook", pattern: /FBAN\/|FBAV\/|FB_IAB\/|FBIOS|FB4A|\[FB/i },
  { app: "WhatsApp", pattern: /WhatsApp/i },
  { app: "TikTok", pattern: /musical_ly|BytedanceWebview|TikTok|trill_\d/i },
  { app: "LinkedIn", pattern: /LinkedInApp/i },
  { app: "X", pattern: /Twitter(?:Android)?|TwitterForiPhone/i },
  { app: "Snapchat", pattern: /Snapchat/i },
  { app: "Pinterest", pattern: /Pinterest/i },
  { app: "Discord", pattern: /Discord/i },
  { app: "Gmail", pattern: /Gmail/i },
  { app: "Google", pattern: /\bGSA\/\d/ },
  { app: "WeChat", pattern: /MicroMessenger/i },
  { app: "LINE", pattern: /\bLine\/\d/i },
  { app: "Telegram", pattern: /Telegram/i },
  { app: "Threads", pattern: /Barcelona/ },
];

/**
 * Detects an in-app browser (WebView inside another app). Returns the app's
 * name when the UA names it, "" for an unnamed WebView, or null for a real
 * browser.
 */
export function detectInAppBrowser(userAgent: string, ios: boolean): string | null {
  for (const { app, pattern } of IN_APP_BROWSERS) {
    if (pattern.test(userAgent)) return app;
  }
  // iOS WKWebView in third-party apps drops the "Safari/" token that Safari,
  // Chrome (CriOS), Firefox (FxiOS) and Edge (EdgiOS) all send.
  if (ios && !/Safari\//.test(userAgent)) return "";
  // Android System WebView marks itself with "; wv)".
  if (/Android/i.test(userAgent) && /;\s*wv\)/.test(userAgent)) return "";
  return null;
}

/** Real iOS browsers that are not Safari (all WebKit; their UAs name themselves). */
const IOS_OTHER_BROWSERS: ReadonlyArray<{ app: string; pattern: RegExp }> = [
  { app: "Chrome", pattern: /CriOS\// },
  { app: "Firefox", pattern: /FxiOS\// },
  { app: "Edge", pattern: /EdgiOS\// },
  { app: "Opera", pattern: /OPiOS\/|OPT\// },
  { app: "DuckDuckGo", pattern: /DuckDuckGo\//i },
  { app: "Yandex", pattern: /YaBrowser\// },
  { app: "Brave", pattern: /Brave\// },
];

export function detectIosOtherBrowser(userAgent: string): string | null {
  for (const { app, pattern } of IOS_OTHER_BROWSERS) {
    if (pattern.test(userAgent)) return app;
  }
  return null;
}

function desktopKind(userAgent: string): InstallGuideKind {
  if (/Firefox\//.test(userAgent) && !/Seamonkey/i.test(userAgent)) return "desktop-firefox";
  if (/\bEdg\//.test(userAgent)) return "desktop-edge";
  if (/\bOPR\//.test(userAgent)) return "desktop-other";
  if (/Chrome\/|Chromium\//.test(userAgent)) return "desktop-chrome";
  if (/Macintosh/.test(userAgent) && /Version\/[\d.]+.*Safari\//.test(userAgent)) return "desktop-safari";
  return "desktop-other";
}

export function installGuideFor(input: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  standalone: boolean;
}): InstallGuide {
  if (input.standalone) return { kind: "installed", app: null };
  const ua = input.userAgent;
  const ios = isIosWebKit(ua, input.platform, input.maxTouchPoints);
  if (ios) {
    const inApp = detectInAppBrowser(ua, true);
    if (inApp !== null) return { kind: "ios-in-app", app: inApp || null };
    const other = detectIosOtherBrowser(ua);
    if (other) return { kind: "ios-other-browser", app: other };
    return { kind: "ios-safari", app: null };
  }
  if (/Android/i.test(ua)) {
    const inApp = detectInAppBrowser(ua, false);
    if (inApp !== null) return { kind: "android-in-app", app: inApp || null };
    return { kind: "android", app: null };
  }
  return { kind: desktopKind(ua), app: null };
}

export function readInstallGuide(standalone: boolean): InstallGuide {
  const nav = window.navigator;
  return installGuideFor({
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    standalone:
      standalone || isStandaloneDisplay(navigatorStandalone(nav), (query) => window.matchMedia(query)),
  });
}

// ---------------------------------------------------------------------------
// Sheet copy (English only, like the rest of the site)
// ---------------------------------------------------------------------------

export type InstallStep = { text: string; shareIcon?: boolean; menuIcon?: boolean };

export type InstallSheetCopy = {
  title: string;
  lead: string;
  steps: InstallStep[];
  foot?: string;
  /** Show the page URL with a Copy link button (in-app / other browsers). */
  copyLink?: boolean;
};

export function installSheetCopy(guide: InstallGuide): InstallSheetCopy {
  switch (guide.kind) {
    case "installed":
      return {
        title: "App installed",
        lead: `${APP_NAME} is installed on this device. Open it any time from its icon on your Home Screen (or your Dock / app list on a computer).`,
        steps: [],
      };
    case "ios-safari":
      return {
        title: `Add ${APP_NAME} to your Home Screen`,
        lead: "Three taps in Safari:",
        steps: [
          { text: "Tap the Share button in Safari's toolbar. If you only see •••, tap that first.", shareIcon: true },
          { text: "Scroll down and choose 'Add to Home Screen'." },
          { text: "Tap 'Add'." },
        ],
        foot: `${APP_NAME} then opens full-screen from its own icon, like an app. Nothing to download from the App Store.`,
      };
    case "ios-other-browser": {
      const browser = guide.app ?? "this browser";
      return {
        title: "Open in Safari to install",
        lead: `On iPhone and iPad, Safari is the browser that reliably adds ${APP_NAME} to your Home Screen. You're in ${browser}.`,
        steps: [
          { text: "Copy the link below." },
          { text: "Open Safari and paste it into the address bar." },
          { text: "In Safari, tap Share, then 'Add to Home Screen', then 'Add'.", shareIcon: true },
        ],
        foot: `Some newer versions of ${browser} also show 'Add to Home Screen' in their own Share menu.`,
        copyLink: true,
      };
    }
    case "ios-in-app":
    case "android-in-app": {
      const ios = guide.kind === "ios-in-app";
      const browser = ios ? "Safari" : "Chrome";
      const app = guide.app ?? "another app";
      return {
        title: `Open in ${browser} to install`,
        lead: `You're viewing this inside ${app}. Apps like this can't add ${APP_NAME} to your Home Screen, so open the page in ${browser} first.`,
        steps: [
          { text: `Tap the ••• or Share menu in ${app} and choose 'Open in ${browser}' (it may say 'Open in browser').` },
          { text: `No such option? Copy the link below and paste it into ${browser}.` },
          ios
            ? { text: "In Safari, tap Share, then 'Add to Home Screen', then 'Add'.", shareIcon: true }
            : { text: "In Chrome, open the ⋮ menu and choose 'Install app' or 'Add to Home screen'.", menuIcon: true },
        ],
        copyLink: true,
      };
    }
    case "android":
      return {
        title: `Install ${APP_NAME}`,
        lead: "Install from your browser's menu:",
        steps: [
          { text: "Tap the ⋮ menu (top right in Chrome).", menuIcon: true },
          { text: "Choose 'Install app' or 'Add to Home screen', then confirm." },
        ],
        foot: "Samsung Internet: menu ≡, then 'Add page to', then 'Home screen'. Firefox: menu ⋮, then 'Install'.",
      };
    case "desktop-chrome":
      return {
        title: `Install ${APP_NAME}`,
        lead: "In Chrome:",
        steps: [
          { text: "Click the install icon at the right end of the address bar." },
          { text: "Or open the ⋮ menu, then 'Cast, save, and share', then 'Install Atman Music…' (older Chrome: 'Install page as app…').", menuIcon: true },
          { text: "Click 'Install'. It opens in its own window and from your Dock, taskbar or Start menu." },
        ],
      };
    case "desktop-edge":
      return {
        title: `Install ${APP_NAME}`,
        lead: "In Microsoft Edge:",
        steps: [
          { text: "Click the 'App available' icon in the address bar." },
          { text: "Or open the … menu, then 'Apps', then 'Install this site as an app'." },
          { text: "Click 'Install'." },
        ],
      };
    case "desktop-safari":
      return {
        title: `Add ${APP_NAME} to your Dock`,
        lead: "In Safari on a Mac (macOS Sonoma or later):",
        steps: [
          { text: "Click File in the menu bar, then 'Add to Dock…'. Or click Share in the toolbar, then 'Add to Dock'.", shareIcon: true },
          { text: "Click 'Add'. It opens in its own window from the Dock." },
        ],
      };
    case "desktop-firefox":
      return {
        title: `Install ${APP_NAME}`,
        lead: "Firefox on desktop doesn't install web apps.",
        steps: [
          { text: "Open atmanmusic.app in Chrome or Edge and use the install icon in the address bar, or in Safari on a Mac use File, then 'Add to Dock…'." },
          { text: "On your phone, open atmanmusic.app and tap 'Install app' in the menu." },
        ],
      };
    case "desktop-other":
    default:
      return {
        title: `Install ${APP_NAME}`,
        lead: "Look for an install icon at the right end of the address bar, or 'Install' in the browser menu.",
        steps: [
          { text: "In Chrome or Edge: the install icon in the address bar." },
          { text: "In Safari on a Mac: File, then 'Add to Dock…'." },
          { text: "On your phone, open atmanmusic.app and tap 'Install app' in the menu." },
        ],
      };
  }
}

/** Footer prompt copy for the current environment. */
export function installPromptBody(opts: { ios: boolean; canPrompt: boolean }): string {
  if (opts.canPrompt) return `Install ${APP_NAME}: one tap, opens full-screen from your Home Screen.`;
  if (opts.ios) return `Add ${APP_NAME} to your Home Screen: it opens full-screen, like an app.`;
  return `Keep ${APP_NAME} on your Home Screen: it opens full-screen, like an app.`;
}

/**
 * Should the subtle footer prompt render? Phones only (desktop keeps just the
 * nav entry) unless Chromium handed us a real one-click prompt; never in the
 * installed app, before the client knows, or after "Not now".
 */
export function shouldShowInstallPrompt(input: {
  hydrated: boolean;
  standalone: boolean;
  dismissed: boolean;
  mobile: boolean;
  ios: boolean;
  canPrompt: boolean;
  chromiumSettled: boolean;
}): boolean {
  if (!input.hydrated || input.standalone || input.dismissed) return false;
  // Give Chromium a moment to fire beforeinstallprompt so the copy and button
  // don't flip from "how to" to "Install" under the visitor's thumb.
  if (!input.ios && !input.canPrompt && !input.chromiumSettled) return false;
  return input.mobile || input.canPrompt;
}
