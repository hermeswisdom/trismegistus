/**
 * Automated QC / test traffic detection — pure, no DOM or server imports.
 *
 * Test traffic must never write production counts (track_plays, listen_marks,
 * visitor presence). It is recognised by any of:
 *   - `?qc=1` on the page URL (persisted in session/local storage on the client)
 *   - an `x-qc-test: 1` request header
 *   - a test-browser user agent (HeadlessChrome, Playwright, and the emulated
 *     iPhone profile our QC harness uses: "iPhone OS 15_0 … Version/26")
 * Counting is also limited to the production deployment (VERCEL_ENV), because
 * previews share the production database.
 */

export const QC_HEADER = "x-qc-test";
export const QC_PARAM = "qc";
export const QC_STORAGE_KEY = "atman_qc";

/** User agents of our automated QC browsers. */
export const QC_UA = /headlesschrome|playwright|iphone os 15_0.*version\/26/i;

export function isQcUserAgent(ua: string | null | undefined): boolean {
  return !!ua && QC_UA.test(ua);
}

/** True when a URL (absolute or relative) or query string carries `qc=1`. */
export function hasQcParam(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, "http://x.invalid");
    return parsed.searchParams.get(QC_PARAM) === "1";
  } catch {
    return false;
  }
}

type HeaderBag = { get(name: string): string | null };

/** Server side: is this request automated QC traffic? */
export function isQcRequest(req: { url?: string; headers: HeaderBag } | null | undefined): boolean {
  if (!req) return false;
  const h = req.headers;
  if (h.get(QC_HEADER)?.trim() === "1") return true;
  if (isQcUserAgent(h.get("user-agent"))) return true;
  // Server functions are POSTed to /_serverFn/…, so look at the page too.
  return hasQcParam(req.url) || hasQcParam(h.get("referer"));
}

/** Counts are only written by the production deployment. */
export function isCountingDeployment(vercelEnv: string | null | undefined): boolean {
  return vercelEnv === "production";
}

/** Server side: may this request write play / listen / visitor counts? */
export function shouldCountRequest(
  req: { url?: string; headers: HeaderBag } | null | undefined,
  vercelEnv: string | null | undefined,
): boolean {
  return isCountingDeployment(vercelEnv) && !isQcRequest(req);
}

type FlagStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Client side: `?qc=1` turns QC mode on for this browser (session + local
 * storage) and `?qc=0` turns it off; otherwise the stored flag or the UA
 * decides. Never throws.
 */
export function detectClientQc(opts: {
  search?: string | null;
  userAgent?: string | null;
  webdriver?: boolean | null;
  stores?: Array<FlagStore | null | undefined>;
}): boolean {
  const stores = (opts.stores ?? []).filter(Boolean) as FlagStore[];
  let param: string | null = null;
  try {
    param = new URLSearchParams(opts.search ?? "").get(QC_PARAM);
  } catch {
    param = null;
  }
  if (param === "1" || param === "0") {
    for (const store of stores) {
      try {
        if (param === "1") store.setItem(QC_STORAGE_KEY, "1");
        else store.removeItem(QC_STORAGE_KEY);
      } catch {
        /* storage blocked */
      }
    }
  }
  if (param === "1") return true;
  if (isQcUserAgent(opts.userAgent)) return true;
  if (opts.webdriver) return true;
  if (param === "0") return false;
  return stores.some((store) => {
    try {
      return store.getItem(QC_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
}
