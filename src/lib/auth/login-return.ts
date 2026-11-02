/**
 * Where sign-in may send a visitor afterwards (`/login?next=…`).
 *
 * Any same-origin path is honoured — `/admin`, `/admin?tab=x`, `/t/some-track`
 * — so a gated page can send a visitor to sign in and get them back exactly
 * where they were. To keep the login route from becoming an open redirector
 * the value must be a plain absolute path:
 *
 *   - starts with a single `/` (not `//host`, which browsers treat as a
 *     protocol-relative URL to another origin);
 *   - no backslashes (`/\evil.example` is normalised to `//evil.example`);
 *   - no control characters or whitespace (browsers strip tabs/newlines, so
 *     `/\t/evil.example` would also become `//evil.example`);
 *   - still resolves to this origin once parsed;
 *   - after `new URL` has resolved `.` / `..` / `%2e` segments, the result
 *     still must not start with `//` (so `/..//evil.example` cannot slip
 *     through) and must not contain a backslash.
 *
 * `/login` itself is refused so a bad value can never loop the visitor back
 * onto the sign-in page. A `#hash` is dropped (it never reaches the server
 * and Better Auth refuses it in a callbackURL). Anything rejected falls back
 * to the wall (`/`).
 */
const PROBE_ORIGIN = "https://login-return.invalid";

export function safeLoginReturnTo(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value.length === 0 || value.length > 2048) return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  if (value.includes("\\")) return undefined;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0020\u007f]/.test(value)) return undefined;
  let url: URL;
  try {
    url = new URL(value, PROBE_ORIGIN);
  } catch {
    return undefined;
  }
  if (url.origin !== PROBE_ORIGIN) return undefined;
  if (url.pathname === "/login" || url.pathname.startsWith("/login/")) return undefined;
  // Check the *normalised* path: `new URL` resolves `/..//host` to `//host`
  // while leaving origin unchanged, so the raw `startsWith("//")` above is
  // not enough.
  const result = `${url.pathname}${url.search}`;
  if (result.startsWith("//") || result.includes("\\")) return undefined;
  return result;
}

/**
 * Better Auth only accepts a relative `callbackURL` / `errorCallbackURL` that
 * matches this shape (better-auth/dist/auth/trusted-origins: a single leading
 * slash, word-ish path characters, an optional simple query). Anything else
 * fails the OAuth start with "Invalid callbackURL", so fall back to the bare
 * path (or the wall) rather than break sign-in.
 */
const BETTER_AUTH_RELATIVE_URL =
  /^\/(?!\/|\\|%2f|%5c)[\w\-.+/@]*(?:\?[\w\-.+/=&%@]*)?$/i;

export function oauthCallbackPath(next: string | undefined): string {
  const safe = safeLoginReturnTo(next);
  if (!safe) return "/";
  if (BETTER_AUTH_RELATIVE_URL.test(safe)) return safe;
  // Query-stripped fallback is taken from the already-checked path, then
  // re-validated so we never emit a value that skipped the // / backslash
  // checks (Better Auth would otherwise get a protocol-relative callbackURL).
  const q = safe.indexOf("?");
  const path = safeLoginReturnTo(q === -1 ? safe : safe.slice(0, q));
  return path && BETTER_AUTH_RELATIVE_URL.test(path) ? path : "/";
}

export function parseLoginSearch(search: Record<string, unknown>): {
  next?: string;
} {
  const next = safeLoginReturnTo(search.next);
  return next ? { next } : {};
}

/**
 * The sign-in page URL that carries a return path, e.g. for an OAuth
 * `errorCallbackURL`, so a failed attempt lands back on /login without
 * losing where the visitor was headed.
 */
export function loginPathWithReturn(next: string | undefined): string {
  const safe = safeLoginReturnTo(next);
  return safe && safe !== "/" ? `/login?next=${encodeURIComponent(safe)}` : "/login";
}
