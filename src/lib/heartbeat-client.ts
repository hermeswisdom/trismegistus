/**
 * One visitor heartbeat per tab (browser only). The loop lives at module
 * level, so remounting the badge on client navigation re-subscribes instead
 * of starting a second timer or an extra ping. Pings every 90s only while the
 * tab is visible; hidden tabs send nothing.
 */
import { isQcBrowser } from "@/lib/qc-client";
import {
  nextHeartbeatDelay,
  parseCounts,
  readOrCreateVisitorId,
  type VisitorCounts,
} from "@/lib/visitor-count";
import { visitorHeartbeat } from "@/lib/visitors";

type Listener = (counts: VisitorCounts | null) => void;

const listeners = new Set<Listener>();
let started = false;
let counts: VisitorCounts | null = null;
let lastPingAt: number | null = null;
let timer: number | undefined;
let inFlight = false;
let failures = 0;
let visitorId: string | undefined;

function emit() {
  for (const l of listeners) l(counts);
}

function schedule(resumed = false) {
  window.clearTimeout(timer);
  timer = undefined;
  const delay = nextHeartbeatDelay({ hidden: document.hidden, lastPingAt, now: Date.now(), resumed });
  if (delay == null) return;
  timer = window.setTimeout(beat, delay);
}

async function beat() {
  timer = undefined;
  if (inFlight || document.hidden) return;
  inFlight = true;
  lastPingAt = Date.now();
  try {
    counts = parseCounts(await visitorHeartbeat({ data: { id: visitorId } }));
    failures = 0;
  } catch {
    // One network blip keeps the last reading; a second hides the badge.
    failures += 1;
    if (failures >= 2) counts = null;
  } finally {
    inFlight = false;
    emit();
    schedule();
  }
}

function onVisibility() {
  if (document.hidden) {
    window.clearTimeout(timer);
    timer = undefined;
  } else {
    schedule(true);
  }
}

function start() {
  if (started) return;
  started = true;
  let store: Storage | null = null;
  try {
    store = window.localStorage;
  } catch {
    store = null;
  }
  // QC browsers read the counts without registering presence.
  visitorId = isQcBrowser() ? undefined : readOrCreateVisitorId(store);
  document.addEventListener("visibilitychange", onVisibility);
  schedule();
}

/** Subscribe to live counts; starts the tab's heartbeat on first use. */
export function subscribeVisitorCounts(listener: Listener): () => void {
  listeners.add(listener);
  start();
  listener(counts);
  return () => {
    listeners.delete(listener);
  };
}
