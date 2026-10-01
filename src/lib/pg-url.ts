/**
 * pg-connection-string currently treats sslmode=prefer/require/verify-ca as
 * verify-full and warns that this will change. Spell out verify-full so the
 * behaviour stays exactly as today and the deprecation warning goes away.
 * URLs that opt into libpq semantics (uselibpqcompat) are left untouched.
 */
export function normalizePgSslMode(url: string): string {
  if (/[?&]uselibpqcompat=/i.test(url)) return url;
  return url.replace(/([?&]sslmode=)(prefer|require|verify-ca)(?=&|#|$)/i, "$1verify-full");
}
