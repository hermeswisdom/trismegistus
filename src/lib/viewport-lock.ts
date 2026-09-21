export const PHONE_LAYOUT_MAX = 860;
export const PHONE_SCREEN_MAX = 512;

export const DEFAULT_VIEWPORT =
  "width=device-width, initial-scale=1, viewport-fit=cover";

export function resolvePhoneViewport(input: {
  screenWidth: number;
  screenHeight: number;
  layoutWidth: number;
}): number | null {
  const screenW = Math.min(input.screenWidth, input.screenHeight);
  if (!screenW || screenW > PHONE_SCREEN_MAX) return null;
  if (input.layoutWidth <= screenW + 16) return null;
  return screenW;
}

export function viewportContent(forcedWidth?: number | null) {
  if (forcedWidth && forcedWidth > 0) {
    return `width=${Math.round(forcedWidth)}, initial-scale=1, viewport-fit=cover`;
  }
  return DEFAULT_VIEWPORT;
}

export function shouldUsePhoneChrome(input: {
  layoutWidth: number;
  screenWidth: number;
  screenHeight: number;
  coarsePointer: boolean;
}) {
  const screenW = Math.min(input.screenWidth, input.screenHeight) || input.layoutWidth;
  if (input.layoutWidth > 0 && input.layoutWidth <= PHONE_LAYOUT_MAX) return true;
  if (screenW > 0 && screenW <= PHONE_SCREEN_MAX) return true;
  return input.coarsePointer && input.layoutWidth <= 1024;
}

export function applyPhoneViewport(
  doc: Pick<Document, "querySelector" | "createElement" | "head"> = document,
  measures?: {
    screenWidth: number;
    screenHeight: number;
    layoutWidth: number;
  },
) {
  const screenWidth = measures?.screenWidth ?? window.screen.width;
  const screenHeight = measures?.screenHeight ?? window.screen.height;
  const layoutWidth =
    measures?.layoutWidth ??
    doc.querySelector("html")?.clientWidth ??
    window.innerWidth;
  const forced = resolvePhoneViewport({ screenWidth, screenHeight, layoutWidth });
  const content = viewportContent(forced);
  let meta = doc.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = doc.createElement("meta");
    meta.setAttribute("name", "viewport");
    doc.head.appendChild(meta);
  }
  if (meta.getAttribute("content") !== content) {
    meta.setAttribute("content", content);
  }
  const phone = shouldUsePhoneChrome({
    layoutWidth: forced ?? layoutWidth,
    screenWidth,
    screenHeight,
    coarsePointer:
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches,
  });
  document.documentElement.classList.toggle("is-phone", phone);
  return { forced, phone };
}
