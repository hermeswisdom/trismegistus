export function cleanMarkName(value: string, max = 40): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Private wall name: account display name, else the email local-part. */
export function markAuthorFromSession(
  user: { name?: string | null; email?: string | null } | null | undefined,
  fallback = "",
): string {
  const named = cleanMarkName(user?.name ?? "");
  if (named) return named;
  const fromEmail = cleanMarkName(user?.email?.split("@")[0] ?? "");
  if (fromEmail) return fromEmail;
  return cleanMarkName(fallback);
}
