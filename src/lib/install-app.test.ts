import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  INSTALL_CAPTURE_SCRIPT,
  INSTALL_DISMISS_KEY,
  INSTALL_DISMISS_MS,
  clearStashedInstallPrompt,
  detectInAppBrowser,
  detectIosOtherBrowser,
  installGuideFor,
  installMenuLabel,
  installSheetCopy,
  isIosWebKit,
  isStandaloneDisplay,
  readDismissedUntil,
  readStashedAppInstalled,
  readStashedInstallPrompt,
  shouldShowInstallPrompt,
  stashedInstallState,
  writeDismissedUntil,
  type BeforeInstallPromptEvent,
  type InstallGuideKind,
} from "./install-app.ts";
import { hasLinkRel, injectGrokPwaHead } from "../../scripts/grok-pwa-shared.mjs";

const ROOT = join(import.meta.dirname, "..", "..");

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1";
const IPHONE_FIREFOX =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/143.0 Mobile/15E148 Safari/605.1.15";
const IPHONE_EDGE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/140.0.3485.54 Mobile/15E148 Safari/605.1.15";
const IPHONE_INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 398.0.0.20.95 (iPhone15,2; iOS 18_6; en_GB; en-GB; scale=3.00; 1179x2556; 789012345)";
const IPHONE_FACEBOOK =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/520.0.0.38.101;FBBV/123;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.6;FBSS/3;FBCR/;FBID/phone;FBLC/en_GB;FBOP/80]";
const IPHONE_MESSENGER =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/500.0.0.30.110;FBBV/1;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS]";
const IPHONE_X =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/11.10";
const IPHONE_GOOGLE_APP =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/385.0.786481012 Mobile/15E148 Safari/604.1";
const IPHONE_UNNAMED_WEBVIEW =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const IPAD_DESKTOP_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";
const PIXEL_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const ANDROID_INSTAGRAM =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A.240905.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 Instagram 398.0.0.0.1 Android (34/14; 420dpi; 1080x2400; Google/google; Pixel 7; panther; panther; en_GB; 712345678)";
const ANDROID_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A.240905.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const DESKTOP_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";
const DESKTOP_FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";

function guide(userAgent: string, opts: { platform?: string; touch?: number; standalone?: boolean } = {}) {
  return installGuideFor({
    userAgent,
    platform:
      opts.platform ??
      (/iPhone/.test(userAgent) ? "iPhone" : /Android/.test(userAgent) ? "Linux armv8l" : /Mac/.test(userAgent) ? "MacIntel" : "Win32"),
    maxTouchPoints: opts.touch ?? (/iPhone|Android/.test(userAgent) ? 5 : 0),
    standalone: opts.standalone ?? false,
  });
}

describe("installGuideFor: one set of steps per platform", () => {
  it("iPhone Safari gets Share → Add to Home Screen", () => {
    assert.deepEqual(guide(IPHONE_SAFARI), { kind: "ios-safari", app: null });
    const copy = installSheetCopy(guide(IPHONE_SAFARI));
    assert.match(copy.steps[0].text, /Share button \{share\}/);
    assert.match(copy.steps[1].text, /Add to Home Screen/);
  });

  it("iPadOS desktop-class Safari (MacIntel + touch) counts as iOS Safari", () => {
    assert.equal(isIosWebKit(IPAD_DESKTOP_SAFARI, "MacIntel", 5), true);
    assert.deepEqual(guide(IPAD_DESKTOP_SAFARI, { platform: "MacIntel", touch: 5 }), { kind: "ios-safari", app: null });
  });

  it("iOS Chrome / Firefox / Edge are told to open the page in Safari", () => {
    for (const [ua, app] of [
      [IPHONE_CHROME, "Chrome"],
      [IPHONE_FIREFOX, "Firefox"],
      [IPHONE_EDGE, "Edge"],
    ] as const) {
      assert.deepEqual(guide(ua), { kind: "ios-other-browser", app }, app);
      const copy = installSheetCopy(guide(ua));
      assert.match(copy.title, /Open in Safari/);
      assert.match(copy.lead, new RegExp(`You're in ${app}`));
      assert.equal(copy.copyLink, true);
    }
    assert.equal(detectIosOtherBrowser(IPHONE_SAFARI), null);
  });

  it("names iOS in-app browsers and sends them to Safari", () => {
    for (const [ua, app] of [
      [IPHONE_INSTAGRAM, "Instagram"],
      [IPHONE_FACEBOOK, "Facebook"],
      [IPHONE_MESSENGER, "Messenger"],
      [IPHONE_X, "X"],
      [IPHONE_GOOGLE_APP, "Google"],
    ] as const) {
      assert.deepEqual(guide(ua), { kind: "ios-in-app", app }, app);
    }
    assert.deepEqual(guide(IPHONE_UNNAMED_WEBVIEW), { kind: "ios-in-app", app: null });
    assert.match(installSheetCopy(guide(IPHONE_INSTAGRAM)).title, /Open in Safari/);
  });

  it("Android Chrome without a prompt gets the ⋮ menu steps; WebViews go to Chrome", () => {
    assert.deepEqual(guide(PIXEL_CHROME), { kind: "android", app: null });
    assert.match(installSheetCopy(guide(PIXEL_CHROME)).steps[1].text, /Install app/);
    assert.deepEqual(guide(ANDROID_INSTAGRAM), { kind: "android-in-app", app: "Instagram" });
    assert.deepEqual(guide(ANDROID_WEBVIEW), { kind: "android-in-app", app: null });
    assert.match(installSheetCopy(guide(ANDROID_WEBVIEW)).title, /Open in Chrome/);
  });

  it("desktop browsers get their own steps", () => {
    const cases: Array<[string, InstallGuideKind, RegExp]> = [
      [DESKTOP_CHROME, "desktop-chrome", /address bar/],
      [DESKTOP_EDGE, "desktop-edge", /App available/],
      [MAC_SAFARI, "desktop-safari", /Add to Dock/],
      [DESKTOP_FIREFOX, "desktop-firefox", /Chrome or Edge/],
    ];
    for (const [ua, kind, text] of cases) {
      const g = guide(ua);
      assert.equal(g.kind, kind, ua);
      const copy = installSheetCopy(g);
      assert.match([copy.lead, ...copy.steps.map((s) => s.text)].join(" "), text, kind);
    }
  });

  it("standalone display wins over everything and says App installed", () => {
    for (const ua of [IPHONE_SAFARI, IPHONE_CHROME, IPHONE_INSTAGRAM, PIXEL_CHROME, DESKTOP_CHROME, MAC_SAFARI]) {
      assert.deepEqual(guide(ua, { standalone: true }), { kind: "installed", app: null });
    }
    assert.equal(installSheetCopy({ kind: "installed", app: null }).title, "App installed");
    assert.equal(installMenuLabel(true), "App installed");
    assert.equal(installMenuLabel(false), "Install app");
  });

  it("every guide kind has a title, a lead and plain-text steps", () => {
    const kinds: InstallGuideKind[] = [
      "installed",
      "ios-safari",
      "ios-other-browser",
      "ios-in-app",
      "android",
      "android-in-app",
      "desktop-chrome",
      "desktop-edge",
      "desktop-safari",
      "desktop-firefox",
      "desktop-other",
    ];
    for (const kind of kinds) {
      const copy = installSheetCopy({ kind, app: null });
      assert.ok(copy.title.length > 0 && copy.lead.length > 0, kind);
      for (const step of copy.steps) {
        assert.doesNotMatch(step.text.replaceAll("{share}", ""), /[{}]|undefined|null/, kind);
        assert.ok(step.text.split("{share}").length <= 2, `${kind}: at most one Share icon per step`);
      }
    }
  });
});

describe("detectInAppBrowser", () => {
  it("returns null for real browsers", () => {
    for (const ua of [IPHONE_SAFARI, IPHONE_CHROME, IPHONE_FIREFOX, IPHONE_EDGE]) assert.equal(detectInAppBrowser(ua, true), null);
    for (const ua of [PIXEL_CHROME, DESKTOP_CHROME]) assert.equal(detectInAppBrowser(ua, false), null);
  });

  it("prefers Messenger / Instagram over the generic Facebook tokens", () => {
    assert.equal(detectInAppBrowser(IPHONE_MESSENGER, true), "Messenger");
    assert.equal(detectInAppBrowser(IPHONE_INSTAGRAM, true), "Instagram");
  });
});

describe("isStandaloneDisplay", () => {
  const mm = (matching: string[]) => (query: string) => ({ matches: matching.includes(query) });
  it("iOS navigator.standalone or display-mode standalone / window-controls-overlay", () => {
    assert.equal(isStandaloneDisplay(true, mm([])), true);
    assert.equal(isStandaloneDisplay(undefined, mm(["(display-mode: standalone)"])), true);
    assert.equal(isStandaloneDisplay(undefined, mm(["(display-mode: window-controls-overlay)"])), true);
  });
  it("a fullscreen browser tab is not the installed app", () => {
    assert.equal(isStandaloneDisplay(false, mm(["(display-mode: fullscreen)"])), false);
    assert.equal(isStandaloneDisplay(undefined, undefined), false);
  });
});

describe("early beforeinstallprompt capture (head script)", () => {
  function fakeWindow() {
    const listeners = new Map<string, Array<(e: unknown) => void>>();
    return {
      addEventListener(type: string, fn: (e: unknown) => void) {
        listeners.set(type, [...(listeners.get(type) ?? []), fn]);
      },
      fire(type: string, e: unknown) {
        for (const fn of listeners.get(type) ?? []) fn(e);
      },
    };
  }
  const runHeadScript = (win: object) => new Function("window", INSTALL_CAPTURE_SCRIPT)(win);
  const fakePrompt = () => {
    let prevented = 0;
    const event = {
      preventDefault: () => void prevented++,
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    } as unknown as BeforeInstallPromptEvent;
    return { event, prevented: () => prevented };
  };

  it("defers the event and stashes it for the provider", () => {
    const win = fakeWindow();
    runHeadScript(win);
    assert.equal(readStashedInstallPrompt(win), null);
    const { event, prevented } = fakePrompt();
    win.fire("beforeinstallprompt", event);
    assert.equal(prevented(), 1, "Chrome's own mini-infobar is suppressed");
    assert.equal(readStashedInstallPrompt(win), event);
    assert.equal(readStashedAppInstalled(win), false);
    clearStashedInstallPrompt(win);
    assert.equal(readStashedInstallPrompt(win), null, "a used prompt is not picked up again");
  });

  it("records appinstalled and drops the stashed prompt", () => {
    const win = fakeWindow();
    runHeadScript(win);
    win.fire("beforeinstallprompt", fakePrompt().event);
    win.fire("appinstalled", {});
    assert.equal(readStashedInstallPrompt(win), null);
    assert.equal(readStashedAppInstalled(win), true);
  });

  it("never throws without addEventListener", () => {
    assert.doesNotThrow(() => runHeadScript({}));
  });

  it("the provider's listener-effect re-check picks up a prompt that fired after first render", () => {
    // Render: nothing stashed yet, provider state starts empty.
    const win = fakeWindow();
    runHeadScript(win);
    const atRender = stashedInstallState(win, { deferred: null, installed: false });
    assert.deepEqual(atRender, { deferred: null, installed: false });
    // Chrome fires between render and the effect: only the head script hears it.
    const { event } = fakePrompt();
    win.fire("beforeinstallprompt", event);
    // The effect, after attaching its own listeners, re-reads the stash.
    assert.equal(stashedInstallState(win, atRender).deferred, event);
    // A prompt the provider already holds is kept, not replaced.
    const held = fakePrompt().event;
    assert.equal(stashedInstallState(win, { deferred: held, installed: false }).deferred, held);
    // appinstalled in that gap wins: installed, no prompt.
    win.fire("appinstalled", {});
    assert.deepEqual(stashedInstallState(win, { deferred: held, installed: false }), { deferred: null, installed: true });
  });

  it("the provider re-checks the stash inside the listener effect (wiring)", () => {
    const src = readFileSync(join(ROOT, "src/components/install-app.tsx"), "utf8");
    const effect = src.slice(src.indexOf('addEventListener("beforeinstallprompt"'));
    const effectEnd = effect.indexOf("}, []);");
    assert.ok(effectEnd > 0);
    assert.match(effect.slice(0, effectEnd), /stashedInstallState\(window/, "stash re-read inside the effect, after addEventListener");
    assert.match(src, /clearStashedInstallPrompt\(window\)/);
    // prompt() must run inside the click, not after an await.
    const request = src.slice(src.indexOf("const requestInstall"), src.indexOf("const dismissPrompt"));
    assert.doesNotMatch(request.slice(0, request.indexOf(".prompt()")), /await/);
  });

  it("root renders the capture script in <head>", () => {
    const root = readFileSync(join(ROOT, "src/routes/__root.tsx"), "utf8");
    const head = root.slice(root.indexOf("<head>"), root.indexOf("</head>"));
    assert.match(head, /__html: INSTALL_CAPTURE_SCRIPT/);
    assert.match(root, /<InstallAppProvider>/);
  });
});

describe("footer prompt visibility and dismissal", () => {
  const base = {
    hydrated: true,
    standalone: false,
    dismissed: false,
    mobile: true,
    ios: true,
    canPrompt: false,
    chromiumSettled: false,
  };
  it("shows on phones, hides when installed / dismissed / before hydration", () => {
    assert.equal(shouldShowInstallPrompt(base), true);
    assert.equal(shouldShowInstallPrompt({ ...base, standalone: true }), false);
    assert.equal(shouldShowInstallPrompt({ ...base, dismissed: true }), false);
    assert.equal(shouldShowInstallPrompt({ ...base, hydrated: false }), false);
  });
  it("Chromium waits for beforeinstallprompt before choosing copy; desktop only with a real prompt", () => {
    const android = { ...base, ios: false };
    assert.equal(shouldShowInstallPrompt(android), false);
    assert.equal(shouldShowInstallPrompt({ ...android, chromiumSettled: true }), true);
    assert.equal(shouldShowInstallPrompt({ ...android, canPrompt: true }), true);
    const desktop = { ...base, ios: false, mobile: false, chromiumSettled: true };
    assert.equal(shouldShowInstallPrompt(desktop), false);
    assert.equal(shouldShowInstallPrompt({ ...desktop, canPrompt: true }), true);
  });
  it("Not now quiets it for 14 days", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const now = 1_700_000_000_000;
    assert.equal(readDismissedUntil(storage, now), false);
    writeDismissedUntil(storage, now);
    assert.equal(store.get(INSTALL_DISMISS_KEY), String(now + INSTALL_DISMISS_MS));
    assert.equal(readDismissedUntil(storage, now + INSTALL_DISMISS_MS - 1), true);
    assert.equal(readDismissedUntil(storage, now + INSTALL_DISMISS_MS + 1), false);
    assert.equal(readDismissedUntil(null, now), false);
    assert.doesNotThrow(() =>
      writeDismissedUntil({ setItem: () => { throw new Error("quota"); } }, now),
    );
  });
});

/** Width, height and PNG colour type from the IHDR chunk. */
function pngInfo(path: string) {
  const buf = readFileSync(path);
  assert.equal(buf.subarray(1, 4).toString("latin1"), "PNG", path);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] };
}

describe("web manifest and icons", () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, "public/manifest.webmanifest"), "utf8"));
  const css = readFileSync(join(ROOT, "src/styles.css"), "utf8");
  const siteBg = css.match(/--color-bg:\s*(#[0-9a-f]{6})/i)?.[1];

  it("names the app and opens standalone at /", () => {
    assert.equal(manifest.name, "Atman Music");
    assert.ok(typeof manifest.short_name === "string" && manifest.short_name.length > 0 && manifest.short_name.length <= 12);
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.start_url, "/");
    assert.equal(manifest.scope, "/");
    assert.equal(manifest.id, "/");
  });

  it("theme and background match the site background and the theme-color meta", () => {
    const root = readFileSync(join(ROOT, "src/routes/__root.tsx"), "utf8");
    const meta = root.match(/name: "theme-color", content: "(#[0-9a-f]{6})"/i)?.[1];
    assert.ok(siteBg);
    assert.equal(manifest.theme_color.toLowerCase(), siteBg.toLowerCase());
    assert.equal(manifest.background_color.toLowerCase(), siteBg.toLowerCase());
    assert.equal(meta?.toLowerCase(), siteBg.toLowerCase());
  });

  it("ships 192, 512 and maskable 512 PNG icons at their declared sizes", () => {
    const want = [
      ["192x192", "any"],
      ["512x512", "any"],
      ["512x512", "maskable"],
    ];
    for (const [sizes, purpose] of want) {
      const icon = manifest.icons.find((i: { sizes: string; purpose?: string }) => i.sizes === sizes && (i.purpose ?? "any") === purpose);
      assert.ok(icon, `${sizes} ${purpose}`);
      assert.equal(icon.type, "image/png");
      const file = join(ROOT, "public", icon.src);
      assert.ok(existsSync(file), icon.src);
      const info = pngInfo(file);
      assert.equal(`${info.width}x${info.height}`, sizes, icon.src);
      assert.ok(statSync(file).size < 400_000, `${icon.src} stays light`);
    }
  });

  it("apple-touch-icon is a 180px opaque PNG (iOS paints transparency black)", () => {
    const info = pngInfo(join(ROOT, "public/apple-touch-icon.png"));
    assert.deepEqual([info.width, info.height], [180, 180]);
    assert.ok(info.colorType === 2 || info.colorType === 3, "RGB or palette, no alpha channel");
  });

  it("root head links our manifest, icon and apple-mobile-web-app metas, not the Grok placeholder", () => {
    const root = readFileSync(join(ROOT, "src/routes/__root.tsx"), "utf8");
    assert.match(root, /rel: "manifest", href: "\/manifest\.webmanifest"/);
    assert.match(root, /rel: "apple-touch-icon", sizes: "180x180", href: "\/apple-touch-icon\.png"/);
    assert.match(root, /name: "apple-mobile-web-app-title", content: APP_NAME/);
    assert.match(root, /name: "apple-mobile-web-app-capable", content: "yes"/);
    assert.match(root, /name: "apple-mobile-web-app-status-bar-style"/);
    assert.doesNotMatch(root, /__grok\/manifest|__grok\/icon-180/);
  });

  it("the platform head injector keeps an app's own manifest and icon", () => {
    const html =
      '<html><head><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"><meta name="apple-mobile-web-app-title" content="Atman Music"><meta name="theme-color" content="#09080e"></head><body></body></html>';
    const out = injectGrokPwaHead(html, { appName: "Atman Music", projectId: "", site: {} });
    assert.equal(out.match(/rel="manifest"/g)?.length, 1);
    assert.doesNotMatch(out, /__grok\/manifest|__grok\/icon-180/);
    assert.equal(out.match(/apple-mobile-web-app-title/g)?.length, 1);
    assert.equal(hasLinkRel('<link href="/x" rel="icon apple-touch-icon">', "apple-touch-icon"), true);
    assert.equal(hasLinkRel('<link rel="apple-touch-icon-precomposed">', "apple-touch-icon"), false);
    // Apps without their own still get the platform tags.
    assert.match(injectGrokPwaHead("<html><head></head></html>", { projectId: "", site: {} }), /__grok\/manifest\.webmanifest/);
  });

  it("no service worker and no offline cache", () => {
    assert.equal(existsSync(join(ROOT, "public/sw.js")), false);
    assert.equal(existsSync(join(ROOT, "public/service-worker.js")), false);
    assert.equal(manifest.serviceworker, undefined);
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
        d.isDirectory() ? walk(join(dir, d.name)) : /\.(tsx?|mjs)$/.test(d.name) && !d.name.endsWith(".test.ts") ? [join(dir, d.name)] : [],
      );
    for (const file of walk(join(ROOT, "src"))) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /serviceWorker\s*\.\s*register|caches\s*\.\s*open/, file);
    }
  });
});
