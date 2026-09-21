export const PHONE_LAYOUT_MAX = 860;
export const PHONE_SCREEN_MAX = 512;
export const PHONE_CSS_MAX = 430;

export const DEFAULT_VIEWPORT =
  "width=device-width, initial-scale=1, viewport-fit=cover";

/** Chrome iPhone emulation sometimes reports a 2× CSS-pixel screen (390×844 → 780×1688). */
export function phoneCssSize(screenWidth: number, screenHeight: number) {
  let short = Math.min(screenWidth, screenHeight) || 0;
  let long = Math.max(screenWidth, screenHeight) || 0;
  if (!short) return null;
  const aspect = short / long;
  if (
    short > PHONE_CSS_MAX &&
    short <= PHONE_LAYOUT_MAX &&
    aspect > 0 &&
    aspect <= 0.55
  ) {
    short /= 2;
    long /= 2;
  }
  if (short > PHONE_SCREEN_MAX) return null;
  return { width: short, height: long };
}

export function resolvePhoneViewport(input: {
  screenWidth: number;
  screenHeight: number;
  layoutWidth: number;
}): number | null {
  void input.layoutWidth;
  return phoneCssSize(input.screenWidth, input.screenHeight)?.width ?? null;
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
  const css = phoneCssSize(input.screenWidth, input.screenHeight);
  if (css) return true;
  if (input.layoutWidth > 0 && input.layoutWidth <= PHONE_LAYOUT_MAX) return true;
  return input.coarsePointer && input.layoutWidth <= 1024;
}

export function bootPhoneViewport(input: {
  screenWidth: number;
  screenHeight: number;
}) {
  const css = phoneCssSize(input.screenWidth, input.screenHeight);
  if (!css) return null;
  return {
    width: css.width,
    height: css.height,
    content: viewportContent(css.width),
  };
}

type ViewportDoc = Pick<
  Document,
  "querySelector" | "querySelectorAll" | "createElement" | "head"
> & {
  documentElement?: HTMLElement;
};

export function applyPhoneViewport(
  doc: ViewportDoc = document,
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
  const boot = bootPhoneViewport({ screenWidth, screenHeight });
  const forced =
    boot?.width ??
    resolvePhoneViewport({ screenWidth, screenHeight, layoutWidth });
  const content = viewportContent(forced);
  const metas = doc.querySelectorAll('meta[name="viewport"]');
  let meta = metas[0] ?? null;
  if (metas.length > 1) {
    for (let i = 1; i < metas.length; i += 1) metas[i]?.remove();
  }
  if (!meta) {
    meta = doc.createElement("meta");
    meta.setAttribute("name", "viewport");
    doc.head.appendChild(meta);
  }
  if (meta.getAttribute("content") !== content) {
    meta.setAttribute("content", content);
  }
  const root =
    doc.documentElement ??
    (doc.querySelector("html") as HTMLElement | null) ??
    document.documentElement;
  const phone = shouldUsePhoneChrome({
    layoutWidth: forced ?? layoutWidth,
    screenWidth,
    screenHeight,
    coarsePointer:
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches,
  });
  root.classList.toggle("is-phone", phone);
  if (boot) {
    root.style.setProperty("--phone-w", `${Math.round(boot.width)}px`);
    root.style.setProperty("--phone-h", `${Math.round(boot.height)}px`);
  } else {
    root.style.removeProperty("--phone-w");
    root.style.removeProperty("--phone-h");
  }
  return { forced, phone };
}

/**
 * Blocking head script. Runs before `<body>` so the first paint uses a numeric
 * phone width — `useEffect` viewport changes do not shrink Chrome's layout viewport.
 */
export const PHONE_VIEWPORT_BOOT = `(function(){var s=window.screen,a=s.width||0,b=s.height||0,short=Math.min(a,b),long=Math.max(a,b);if(!short)return;if(short>${PHONE_CSS_MAX}&&short<=${PHONE_LAYOUT_MAX}&&short/long<=0.55){short/=2;long/=2;}if(short>${PHONE_SCREEN_MAX})return;var m=document.querySelector('meta[name="viewport"]');if(!m){m=document.createElement("meta");m.setAttribute("name","viewport");document.head.appendChild(m);}m.setAttribute("content","width="+Math.round(short)+", initial-scale=1, viewport-fit=cover");var extra=document.querySelectorAll('meta[name="viewport"]');for(var i=1;i<extra.length;i++)extra[i].parentNode&&extra[i].parentNode.removeChild(extra[i]);var r=document.documentElement;r.classList.add("is-phone");r.style.setProperty("--phone-w",Math.round(short)+"px");r.style.setProperty("--phone-h",Math.round(long)+"px");})();`;
