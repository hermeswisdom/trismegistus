import type { EbookFormat } from "@/lib/ebook";
import { isQcBrowser } from "@/lib/qc-client";

/**
 * Count a free ebook download (once per format per tab session). Never blocks
 * or delays the download itself; QC browsers never send anything.
 */
export function countEbookDownload(format: EbookFormat): void {
  if (typeof window === "undefined" || isQcBrowser()) return;
  const key = `atman_ebook_${format}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    /* storage blocked: still count */
  }
  const url = `/api/ebook/hit?format=${format}`;
  try {
    if (navigator.sendBeacon?.(url)) return;
  } catch {
    /* fall through */
  }
  void fetch(url, { method: "POST", keepalive: true, credentials: "same-origin" }).catch(() => {});
}
