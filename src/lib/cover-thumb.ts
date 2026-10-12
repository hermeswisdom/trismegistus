/**
 * 480px thumbnail of a catalogue cover (public/images/tracks/thumbs, made by
 * scripts/make-thumbs.py). Used by the enter-gate mosaic, whose cells are far
 * smaller than the 1000px covers React would otherwise preload in full.
 */
export function coverThumb(image: string): string {
  return image.replace(/^\/images\/tracks\/([^/]+\.jpg)$/, "/images/tracks/thumbs/$1");
}
