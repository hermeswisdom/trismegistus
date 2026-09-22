export function parseDownloadSearch(search: Record<string, unknown>): {
  session_id?: string;
  receipt?: string;
  cancelled?: 1;
  tablet?: string;
} {
  const session_id =
    typeof search.session_id === "string" && search.session_id.trim()
      ? search.session_id.trim().slice(0, 200)
      : undefined;
  const receipt =
    typeof search.receipt === "string" && search.receipt.trim()
      ? search.receipt.trim().slice(0, 96)
      : undefined;
  const raw = search.cancelled;
  const cancelled =
    raw === true || raw === 1 || raw === "1" || raw === "true" ? 1 : undefined;
  const tablet =
    typeof search.tablet === "string" && search.tablet.trim()
      ? search.tablet.trim().slice(0, 80)
      : undefined;
  return {
    ...(session_id ? { session_id } : {}),
    ...(receipt ? { receipt } : {}),
    ...(cancelled ? { cancelled } : {}),
    ...(tablet ? { tablet } : {}),
  };
}
