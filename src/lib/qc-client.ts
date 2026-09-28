import { detectClientQc } from "@/lib/qc-traffic";

let cached: boolean | null = null;

function storages(): Storage[] {
  const out: Storage[] = [];
  try {
    out.push(window.sessionStorage);
  } catch {
    /* blocked */
  }
  try {
    out.push(window.localStorage);
  } catch {
    /* blocked */
  }
  return out;
}

/** Is this browser automated QC traffic? Resolved once per page load. */
export function isQcBrowser(): boolean {
  if (typeof window === "undefined") return false;
  if (cached === null) {
    cached = detectClientQc({
      search: window.location.search,
      userAgent: navigator.userAgent,
      webdriver: (navigator as Navigator & { webdriver?: boolean }).webdriver ?? false,
      stores: storages(),
    });
  }
  return cached;
}
