/**
 * Seasonal "solstice night" skin. Pure helpers so node:test can load them.
 *
 * Dates live in SOLSTICE_SKIN — change that object to move the window.
 * The look is CSS on `html[data-skin="solstice"]`. React never branches on
 * it, so the first client render stays byte-identical to the SSR HTML
 * (no React #418). A tiny head script sets the attribute before first paint.
 */

export const SOLSTICE_SKIN = {
  id: "solstice",
  timezone: "Europe/London",
  queryParam: "skin",
  onValue: "solstice",
  offValue: "off",
  /** Browser chrome while the skin is on. Matches the indigo `--color-bg`. */
  themeColor: "#07061a",
  /** Resting theme-color from `src/routes/__root.tsx`. */
  restThemeColor: "#09080e",
  /** Inclusive civil start: 1 Dec 00:00 Europe/London, every year. */
  start: { month: 12, day: 1, hour: 0, minute: 0 },
  /** Inclusive civil end: 6 Jan 23:59 Europe/London, every year. */
  end: { month: 1, day: 6, hour: 23, minute: 59 },
} as const;

export type SolsticeSkinConfig = typeof SOLSTICE_SKIN;
export type CivilStamp = {
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export type SkinOverride = "on" | "off";

/** Minutes from a dummy year origin. Month*32 fits days 1–31. */
export function civilMinutes(stamp: CivilStamp): number {
  return ((stamp.month * 32 + stamp.day) * 24 + stamp.hour) * 60 + stamp.minute;
}

export function londonCivilStamp(
  at: Date,
  timeZone: string = SOLSTICE_SKIN.timezone,
): CivilStamp {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(at);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
  };
}

/**
 * Recurring civil window. When start > end (Dec → Jan) the range wraps
 * the new year; otherwise it is a same-year interval. End is inclusive
 * through that minute.
 */
export function isInRecurringWindow(
  stamp: CivilStamp,
  start: CivilStamp,
  end: CivilStamp,
): boolean {
  const t = civilMinutes(stamp);
  const a = civilMinutes(start);
  const b = civilMinutes(end);
  if (a <= b) return t >= a && t <= b;
  return t >= a || t <= b;
}

export function isInSolsticeWindow(
  at: Date = new Date(),
  config: Pick<
    SolsticeSkinConfig,
    "timezone" | "start" | "end"
  > = SOLSTICE_SKIN,
): boolean {
  return isInRecurringWindow(
    londonCivilStamp(at, config.timezone),
    config.start,
    config.end,
  );
}

function skinParamFromUrl(url: string): string {
  try {
    return (
      new URL(url, "http://x.invalid").searchParams.get(
        SOLSTICE_SKIN.queryParam,
      ) ?? ""
    );
  } catch {
    return "";
  }
}

/** `solstice` | `off` from a query string, URL, URLSearchParams, or search object. */
export function parseSkinQueryValue(
  search?: string | URLSearchParams | Record<string, unknown> | null,
): "solstice" | "off" | undefined {
  if (search == null || search === "") return undefined;
  let raw: unknown;
  if (typeof search === "string") {
    raw = skinParamFromUrl(
      search.includes("://") || search.startsWith("/") || search.startsWith("?")
        ? search
        : `?${search}`,
    );
  } else if (
    typeof URLSearchParams !== "undefined" &&
    search instanceof URLSearchParams
  ) {
    raw = search.get(SOLSTICE_SKIN.queryParam);
  } else {
    raw = (search as Record<string, unknown>)[SOLSTICE_SKIN.queryParam];
  }
  if (raw === SOLSTICE_SKIN.onValue || raw === SOLSTICE_SKIN.offValue)
    return raw;
  return undefined;
}

export function parseSkinOverride(
  search?: string | URLSearchParams | Record<string, unknown> | null,
): SkinOverride | null {
  const value = parseSkinQueryValue(search);
  if (value === SOLSTICE_SKIN.onValue) return "on";
  if (value === SOLSTICE_SKIN.offValue) return "off";
  return null;
}

export function isSolsticeSkinActive(
  input: {
    now?: Date;
    search?: string | URLSearchParams | Record<string, unknown> | null;
    config?: Pick<SolsticeSkinConfig, "timezone" | "start" | "end">;
  } = {},
): boolean {
  const override = parseSkinOverride(input.search);
  if (override === "on") return true;
  if (override === "off") return false;
  return isInSolsticeWindow(input.now ?? new Date(), input.config);
}

type SkinRoot = {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

type ThemeMeta = { setAttribute(name: string, value: string): void } | null;

/**
 * Apply or clear `data-skin` (and the matching theme-color). Used by the
 * layout effect after hydrate in case React patched the html node.
 */
export function applySolsticeSkin(
  root: SkinRoot | null = typeof document !== "undefined"
    ? document.documentElement
    : null,
  input: {
    now?: Date;
    search?: string | URLSearchParams | Record<string, unknown> | null;
    themeMeta?: ThemeMeta;
  } = {},
): boolean {
  const search =
    input.search ?? (typeof location !== "undefined" ? location.search : "");
  const on = isSolsticeSkinActive({ now: input.now, search });
  if (!root) return on;
  if (on) root.setAttribute("data-skin", SOLSTICE_SKIN.id);
  else root.removeAttribute("data-skin");
  const meta =
    input.themeMeta !== undefined
      ? input.themeMeta
      : typeof document !== "undefined"
        ? document.querySelector('meta[name="theme-color"]')
        : null;
  meta?.setAttribute(
    "content",
    on ? SOLSTICE_SKIN.themeColor : SOLSTICE_SKIN.restThemeColor,
  );
  return on;
}

function buildSolsticeSkinBoot(config: SolsticeSkinConfig): string {
  const a = civilMinutes(config.start);
  const b = civilMinutes(config.end);
  return `(function(){try{var m=/[?&]${config.queryParam}=([^&]*)/.exec(location.search),v=m?decodeURIComponent(m[1].replace(/\\+/g," ")):"";var force=v==="${config.onValue}"?1:v==="${config.offValue}"?0:-1;var on=force===1;if(force<0){var p=new Intl.DateTimeFormat("en-GB",{timeZone:"${config.timezone}",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",hourCycle:"h23"}).formatToParts(new Date()),g=function(t){for(var i=0;i<p.length;i++)if(p[i].type===t)return +p[i].value;return 0},t=((g("month")*32+g("day"))*24+g("hour"))*60+g("minute");on=${a}<=${b}?t>=${a}&&t<=${b}:t>=${a}||t<=${b}}var r=document.documentElement;if(on){r.setAttribute("data-skin","${config.id}");var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute("content","${config.themeColor}");}else r.removeAttribute("data-skin")}catch(e){}})();`;
}

/** Inline <head> script. Runs before body paint; React does not read this. */
export const SOLSTICE_SKIN_BOOT = buildSolsticeSkinBoot(SOLSTICE_SKIN);
