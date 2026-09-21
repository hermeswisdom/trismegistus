export function extractClientIp(headers: {
  get(name: string): string | null;
}): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || null;
}

/** Cookie wins; IP is the fallback. Raw values are hashed before storage. */
export function chooseVisitorKey(
  cookieId: string | null | undefined,
  ip: string | null | undefined,
): string {
  const cookie = cookieId?.trim();
  if (cookie) return `c:${cookie}`;
  const address = ip?.trim();
  if (address) return `i:${address}`;
  return "anon";
}
