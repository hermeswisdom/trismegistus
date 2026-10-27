/**
 * Escape on the Auto Mix dock: only when the panel is expanded or the dock
 * itself has focus. A mini dock on screen must not swallow Escape for the
 * marks sheet (and other overlays).
 */
export function autoMixHandlesEscape(opts: {
  expanded: boolean;
  panelHasFocus: boolean;
}): boolean {
  return opts.expanded || opts.panelHasFocus;
}

export function autoMixPanelHasFocus(
  panel: { contains(node: Node): boolean } | null | undefined,
  event: { target: EventTarget | null },
  active: EventTarget | null | undefined,
): boolean {
  if (!panel) return false;
  const fromEvent = event.target;
  if (fromEvent && panel.contains(fromEvent as Node)) return true;
  if (active && panel.contains(active as Node)) return true;
  return false;
}
