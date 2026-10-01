/**
 * TEMPORARY: on-page audio diagnostics for the lock-screen work (PR #31).
 * Enabled with ?debug=audio (remembered on this device until ?debug=off).
 * Logs media / page-lifecycle events and why the native <audio> last paused,
 * so a phone screenshot after unlocking shows what happened while locked.
 * Everything here is a no-op unless enabled; nothing is sent anywhere.
 */
export type DebugEntry = { at: number; kind: string; detail?: string };

export type PauseCall = { at: number; reason: string; stack?: string };

export type PauseRecord = {
  at: number;
  reason: string;
  /** true = our code called pause() (or swapped src); false = browser / OS. */
  ours: boolean;
  visibility: string;
  time: number;
  stack?: string;
};

const FLAG_KEY = "atman-audio-debug";
const LOG_KEY = "atman-audio-debug-log";
const PAUSE_KEY = "atman-audio-debug-pause";
const MAX_LOG = 80;
/** A pause event this soon after our own pause() / src swap is ours. */
export const OWN_PAUSE_WINDOW_MS = 2000;

/** Pure: "on" for ?debug=audio, "off" for ?debug=off / ?debug=0, else null (keep stored). */
export function audioDebugParam(search: string | null | undefined): "on" | "off" | null {
  let value: string | null = null;
  try {
    value = new URLSearchParams(search ?? "").get("debug");
  } catch {
    return null;
  }
  if (value === null) return null;
  const v = value.trim().toLowerCase();
  if (v === "audio") return "on";
  if (v === "off" || v === "0" || v === "false" || v === "none") return "off";
  return null;
}

/** Pure: attribute a media `pause` event to our last pause() call or to the browser / OS. */
export function classifyPause(opts: {
  now: number;
  call: PauseCall | null;
  visibility: string;
  ended: boolean;
}): { ours: boolean; reason: string; stack?: string } {
  if (opts.ended) return { ours: false, reason: "track ended" };
  if (opts.call && opts.now - opts.call.at <= OWN_PAUSE_WINDOW_MS) {
    return { ours: true, reason: opts.call.reason, stack: opts.call.stack };
  }
  return {
    ours: false,
    reason:
      opts.visibility === "hidden"
        ? "browser/OS paused it while the page was hidden (no app code called pause)"
        : "browser/OS paused it (no app code called pause)",
  };
}

/** A short call-site trace (our frames only, newest first). */
export function stackSnippet(skip = 2): string | undefined {
  try {
    const raw = new Error("trace").stack;
    if (!raw) return undefined;
    return raw
      .split("\n")
      .slice(skip)
      .map((l) => l.trim().replace(/^at\s+/, "").replace(/\(?https?:\/\/[^/]+\//, "("))
      .filter((l) => l && !l.startsWith("Error"))
      .slice(0, 5)
      .join(" < ");
  } catch {
    return undefined;
  }
}

let enabled: boolean | null = null;
let log: DebugEntry[] = [];
let lastPause: PauseRecord | null = null;
const subs = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function isAudioDebug(): boolean {
  if (enabled !== null) return enabled;
  if (typeof window === "undefined") return false;
  const st = storage();
  const param = audioDebugParam(window.location.search);
  try {
    if (param === "on") st?.setItem(FLAG_KEY, "1");
    if (param === "off") {
      st?.removeItem(FLAG_KEY);
      st?.removeItem(LOG_KEY);
      st?.removeItem(PAUSE_KEY);
    }
  } catch {
    /* storage blocked */
  }
  enabled = param === "on" || (param !== "off" && st?.getItem(FLAG_KEY) === "1");
  if (enabled) {
    try {
      log = JSON.parse(st?.getItem(LOG_KEY) ?? "[]") as DebugEntry[];
      lastPause = JSON.parse(st?.getItem(PAUSE_KEY) ?? "null") as PauseRecord | null;
    } catch {
      log = [];
    }
  }
  return enabled;
}

function persist() {
  const st = storage();
  try {
    st?.setItem(LOG_KEY, JSON.stringify(log));
    st?.setItem(PAUSE_KEY, JSON.stringify(lastPause));
  } catch {
    /* full / blocked */
  }
}

function notify() {
  subs.forEach((fn) => fn());
}

export function debugEvent(kind: string, detail?: string) {
  if (!isAudioDebug()) return;
  log.push({ at: Date.now(), kind, ...(detail ? { detail } : {}) });
  if (log.length > MAX_LOG) log = log.slice(-MAX_LOG);
  persist();
  notify();
}

export function recordPause(rec: PauseRecord) {
  lastPause = rec;
  if (!isAudioDebug()) return;
  debugEvent("pause-reason", `${pauseLabel(rec)}: ${rec.reason} [page ${rec.visibility}, t=${rec.time.toFixed(1)}]`);
}

/** OURS (our code), END (track finished) or SYSTEM (browser / OS). */
export function pauseLabel(rec: Pick<PauseRecord, "ours" | "reason">) {
  if (rec.ours) return "OURS";
  return rec.reason.startsWith("track ended") ? "END" : "SYSTEM";
}

export function getLastPause(): PauseRecord | null {
  return lastPause;
}

export function getDebugLog(): readonly DebugEntry[] {
  return log;
}

export function clearDebugLog() {
  log = [];
  lastPause = null;
  persist();
  notify();
}

export function subscribeDebug(fn: () => void) {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function resetAudioDebugForTests(value: boolean | null = null) {
  enabled = value;
  log = [];
  lastPause = null;
  subs.clear();
}
