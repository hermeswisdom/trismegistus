/** Site-wide poster / video backdrop. Pure helpers so node:test can load them. */

export const SITE_BG_POSTER = "/bg/bg-poster.jpg";
export const SITE_BG_WEBM = "/bg/bg-loop.webm";
export const SITE_BG_MP4 = "/bg/bg-loop.mp4";
export const SITE_BG_NARROW_MAX_PX = 768;

export function isHermesPath(pathname: string | undefined): boolean {
  const path = (pathname ?? "").split(/[?#]/, 1)[0] ?? "";
  return path === "/hermes" || path.startsWith("/hermes/");
}

export function connectionSaveData(nav: {
  connection?: { saveData?: boolean } | null;
  mozConnection?: { saveData?: boolean } | null;
  webkitConnection?: { saveData?: boolean } | null;
}): boolean {
  return Boolean(
    nav.connection?.saveData ||
    nav.mozConnection?.saveData ||
    nav.webkitConnection?.saveData,
  );
}

/**
 * Play the looping clip only when it will not compete with LCP, data-saver,
 * reduced motion, a narrow viewport, or a page that needs a still poster.
 */
export function shouldMountSiteBackgroundVideo(input: {
  narrow: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  posterOnlyRoute: boolean;
}): boolean {
  return (
    !input.narrow &&
    !input.reducedMotion &&
    !input.saveData &&
    !input.posterOnlyRoute
  );
}

export function afterLoadIdle(callback: () => void): () => void {
  let cancelled = false;
  let idleHandle = 0;
  let timeoutHandle = 0;

  const run = () => {
    if (cancelled) return;
    if (typeof requestIdleCallback === "function") {
      idleHandle = requestIdleCallback(
        () => {
          if (!cancelled) callback();
        },
        { timeout: 2000 },
      );
    } else {
      timeoutHandle = window.setTimeout(() => {
        if (!cancelled) callback();
      }, 1);
    }
  };

  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });

  return () => {
    cancelled = true;
    window.removeEventListener("load", run);
    if (typeof cancelIdleCallback === "function" && idleHandle) {
      cancelIdleCallback(idleHandle);
    }
    if (timeoutHandle) window.clearTimeout(timeoutHandle);
  };
}
