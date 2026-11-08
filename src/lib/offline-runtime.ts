/**
 * Register the scoped offline service worker. Never reloads the page on
 * controllerchange — that would interrupt native lock-screen playback.
 * Updates wait until the visitor is not playing, then skipWaiting.
 */
import { nativePhase } from "./native-audio.ts";

export const OFFLINE_SW_URL = "/sw.js";

export function shouldRegisterOfflineWorker(opts: {
  prod: boolean;
  window: { navigator?: { serviceWorker?: unknown } } | undefined;
}): boolean {
  if (!opts.prod) return false;
  return Boolean(opts.window?.navigator && "serviceWorker" in (opts.window.navigator as object));
}

export function shouldActivateWaitingWorker(phase: string): boolean {
  return phase !== "playing" && phase !== "pending";
}

export function registerOfflineWorker(opts?: { prod?: boolean; navigator?: Navigator }): Promise<ServiceWorkerRegistration | null> {
  const prod = opts?.prod ?? (typeof import.meta !== "undefined" && Boolean((import.meta as { env?: { PROD?: boolean } }).env?.PROD));
  const nav = opts?.navigator ?? (typeof navigator === "undefined" ? undefined : navigator);
  if (!shouldRegisterOfflineWorker({ prod, window: nav ? { navigator: nav } : undefined })) {
    return Promise.resolve(null);
  }
  if (!nav?.serviceWorker?.register) return Promise.resolve(null);
  return nav.serviceWorker
    .register(OFFLINE_SW_URL, { scope: "/" })
    .then((registration) => {
      const activateIfQuiet = () => {
        const waiting = registration.waiting;
        if (!waiting) return;
        if (!shouldActivateWaitingWorker(nativePhase())) return;
        waiting.postMessage("skipWaiting");
      };
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed") activateIfQuiet();
        });
      });
      activateIfQuiet();
      return registration;
    })
    .catch(() => null);
}
