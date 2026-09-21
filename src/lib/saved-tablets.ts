/** Catalog tablets the visitor has hearted, in wall order. */
export function savedTablets<T extends { id: string }>(
  tracks: readonly T[],
  hearts: Record<string, true>,
): T[] {
  return tracks.filter((track) => Boolean(hearts[track.id]));
}
