/**
 * Where sign-in may send a visitor afterwards. Only exact internal paths
 * on this allowlist are honoured — never an arbitrary `?next=` value — so
 * the login route cannot become an open-redirector. `/admin` is the one
 * gated page that sends signed-out visitors here (see routes/admin.tsx).
 */
export const LOGIN_RETURN_PATHS: readonly string[] = ["/admin"];

export function safeLoginReturnTo(value: unknown): string | undefined {
  return typeof value === "string" && LOGIN_RETURN_PATHS.includes(value)
    ? value
    : undefined;
}

export function parseLoginSearch(search: Record<string, unknown>): {
  next?: string;
} {
  const next = safeLoginReturnTo(search.next);
  return next ? { next } : {};
}
