/**
 * Pure logic for the live visitor badge — no DB, no DOM. Shared by the
 * heartbeat server function (src/lib/visitors.ts) and the badge component.
 */

/** A browser is "listening now" if it sent a heartbeat this recently. */
export const ONLINE_WINDOW_SECONDS = 120;
/** A browser adds to the all-time total at most once per this window. */
export const COUNT_WINDOW_HOURS = 24;
/** Presence rows older than this are deleted (must exceed COUNT_WINDOW_HOURS). */
export const PRUNE_AFTER_HOURS = 26;
/** Roughly one heartbeat in N runs the prune, keeping the hot path to one query. */
export const PRUNE_ONE_IN = 25;
/** Client heartbeat cadence while the tab is visible / hidden. */
export const HEARTBEAT_MS = 20_000;
export const HIDDEN_HEARTBEAT_MS = 60_000;
/** localStorage key for the random anonymous browser id. */
export const VISITOR_ID_KEY = "atman_visitor_id";

export type VisitorCounts = { online: number; total: number };

const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|embedly|quora link preview|linkpreview|headless|lighthouse|pagespeed|phantomjs|puppeteer|playwright|selenium|curl\/|wget\/|python-requests|python-urllib|go-http-client|axios\/|node-fetch|okhttp|java\/|libwww|httpclient|scrapy|monitor|uptime|pingdom|vercel-screenshot|vercelbot/i;

/** Obvious non-human user agents (crawlers, link unfurlers, headless tooling). */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  const value = ua?.trim();
  if (!value) return true;
  return BOT_UA.test(value);
}

/** Random ids only: 16–64 chars of hex / dashes (crypto.randomUUID or hex). */
export function isValidVisitorId(id: unknown): id is string {
  return typeof id === "string" && /^[a-f0-9-]{16,64}$/i.test(id);
}

export function newVisitorId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

type KeyStore = Pick<Storage, "getItem" | "setItem">;

/** Read the stored anonymous id, or mint and store one. Never throws. */
export function readOrCreateVisitorId(store: KeyStore | null | undefined): string {
  try {
    const existing = store?.getItem(VISITOR_ID_KEY);
    if (isValidVisitorId(existing)) return existing;
  } catch {
    /* storage blocked (private mode) — fall through to a session id */
  }
  const id = newVisitorId();
  try {
    store?.setItem(VISITOR_ID_KEY, id);
  } catch {
    /* id lives for this page only */
  }
  return id;
}

/** Whether this heartbeat should also prune stale presence rows. */
export function shouldPrune(random: number = Math.random()): boolean {
  return random < 1 / PRUNE_ONE_IN;
}

/**
 * Would a browser last counted at `countedAtMs` be counted again at `nowMs`?
 * Mirrors the SQL in visitors.ts (null = never seen = count).
 */
export function shouldCountVisit(countedAtMs: number | null, nowMs: number): boolean {
  if (countedAtMs == null) return true;
  return nowMs - countedAtMs >= COUNT_WINDOW_HOURS * 3600 * 1000;
}

/** Is a heartbeat at `lastSeenMs` still "online" at `nowMs`? */
export function isOnline(lastSeenMs: number, nowMs: number): boolean {
  return nowMs - lastSeenMs <= ONLINE_WINDOW_SECONDS * 1000;
}

function toCount(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/** Normalise a DB row / server payload; null hides the badge. */
export function parseCounts(value: unknown): VisitorCounts | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const online = toCount(row.online);
  const total = toCount(row.total);
  if (online == null || total == null) return null;
  // You are here, so the total can never read below the live count.
  return { online, total: Math.max(total, online) };
}

const NUMBER = new Intl.NumberFormat("en-GB");

export function formatCount(n: number): string {
  return NUMBER.format(n);
}

export function onlineLabel(online: number): string {
  return `${formatCount(online)} listening now`;
}

export function totalLabel(total: number): string {
  return `${formatCount(total)} ${total === 1 ? "visitor" : "visitors"}`;
}

/** "3 listening now · 1,204 visitors" */
export function badgeText(counts: VisitorCounts): string {
  return `${onlineLabel(counts.online)} · ${totalLabel(counts.total)}`;
}
