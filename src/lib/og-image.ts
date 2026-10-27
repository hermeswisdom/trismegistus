import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement as h, type ReactElement } from "react";
// 0.6.8's node entry reads wasm via ESM fs + import.meta.url. 1.x crashes in
// Nitro ESM (harfbuzz `require("fs")`) and returns an empty PNG body.
import { ImageResponse } from "@vercel/og";
import outfitWoff from "./og-fonts/outfit-400.woff?inline";
import syneWoff from "./og-fonts/syne-700.woff?inline";
import { SOUNDCLOUD_TRACKS } from "./soundcloud-tracks.ts";
import {
  MOOD_PALETTES,
  OG_CACHE_CONTROL,
  OG_IMAGE_SIZE,
  SITE_NAME,
  SITE_PALETTE,
  parseOgSearch,
  titleFontSize,
  type OgPalette,
} from "./og-card.ts";
import { moodForSlug } from "./og-mood.ts";
import { SITE_ORIGIN } from "./tablet-link.ts";

const PNG_HEADERS = {
  "Content-Type": "image/png",
  "Cache-Control": OG_CACHE_CONTROL,
  "CDN-Cache-Control": OG_CACHE_CONTROL,
  "X-Robots-Tag": "noindex",
};

function fontFromDataUri(uri: string): ArrayBuffer {
  const comma = uri.indexOf(",");
  const buf = Buffer.from(comma >= 0 ? uri.slice(comma + 1) : uri, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

let fonts:
  | {
      name: string;
      data: ArrayBuffer;
      weight: 400 | 700;
      style: "normal";
    }[]
  | undefined;

function ogFonts() {
  fonts ??= [
    { name: "Syne", data: fontFromDataUri(syneWoff), weight: 700, style: "normal" },
    { name: "Outfit", data: fontFromDataUri(outfitWoff), weight: 400, style: "normal" },
  ];
  return fonts;
}

function trackBySlug(slug: string) {
  return SOUNDCLOUD_TRACKS.find((track) => track.slug === slug || track.id === slug);
}

function asJpegDataUri(buf: Buffer): string | null {
  if (buf.length < 3 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return null;
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

function coverFromDisk(slug: string): string | null {
  const rel = join("images", "tracks", `${slug}.jpg`);
  for (const path of [join(process.cwd(), "public", rel), join(process.cwd(), rel)]) {
    try {
      const uri = asJpegDataUri(readFileSync(path));
      if (uri) return uri;
    } catch {
      /* try the next path / origin fetch */
    }
  }
  return null;
}

async function fetchJpeg(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    return asJpegDataUri(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

async function coverSrc(slug: string, origin: string): Promise<string | null> {
  const fromDisk = coverFromDisk(slug);
  if (fromDisk) return fromDisk;
  // Preview hosts are behind Vercel SSO; Satori cannot parse the login HTML.
  const fromSite = await fetchJpeg(`${SITE_ORIGIN}/images/tracks/${slug}.jpg`);
  if (fromSite) return fromSite;
  const host = origin.replace(/\/$/, "");
  if (host !== SITE_ORIGIN) return fetchJpeg(`${host}/images/tracks/${slug}.jpg`);
  return null;
}

function DefaultCard(palette: OgPalette = SITE_PALETTE): ReactElement {
  return h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "72px 80px",
        backgroundColor: palette.bg,
        color: palette.fg,
        position: "relative",
      },
    },
    h("div", {
      style: {
        position: "absolute",
        top: "-120px",
        right: "-80px",
        width: "560px",
        height: "560px",
        borderRadius: "999px",
        backgroundColor: palette.accent,
        opacity: 0.14,
      },
    }),
    h(
      "div",
      {
        style: {
          display: "flex",
          fontFamily: "Outfit",
          fontSize: "22px",
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: palette.muted,
        },
      },
      SITE_NAME,
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          marginTop: "24px",
          fontFamily: "Syne",
          fontSize: "96px",
          fontWeight: 700,
          lineHeight: 0.9,
          letterSpacing: "-0.05em",
        },
      },
      h("div", { style: { display: "flex" } }, "ATMAN"),
      h("div", { style: { display: "flex" } }, "MUSIC"),
    ),
    h("div", {
      style: {
        display: "flex",
        width: "168px",
        height: "8px",
        backgroundColor: palette.accent,
        marginTop: "28px",
      },
    }),
    h(
      "div",
      {
        style: {
          display: "flex",
          marginTop: "36px",
          fontFamily: "Outfit",
          fontSize: "28px",
          color: palette.muted,
          lineHeight: 1.45,
        },
      },
      "Play a tablet. Read the verse. Leave a mark.",
    ),
  );
}

function TrackCard(props: {
  title: string;
  cover: string | null;
  palette: OgPalette;
}): ReactElement {
  const size = titleFontSize(props.title);
  const cover = props.cover
    ? h("img", {
        src: props.cover,
        width: 512,
        height: 512,
        alt: "",
        style: { width: "512px", height: "512px", objectFit: "cover" },
      })
    : h(
        "div",
        {
          style: {
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Syne",
            fontSize: "96px",
            fontWeight: 700,
            color: props.palette.bg,
          },
        },
        "A",
      );
  return h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: props.palette.bg,
        color: props.palette.fg,
        position: "relative",
      },
    },
    h("div", {
      style: {
        display: "flex",
        width: "16px",
        height: "100%",
        backgroundColor: props.palette.accent,
      },
    }),
    h(
      "div",
      {
        style: {
          display: "flex",
          padding: "56px 56px 56px 48px",
          gap: "48px",
          alignItems: "center",
          flex: 1,
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            width: "520px",
            height: "520px",
            borderRadius: "8px",
            overflow: "hidden",
            backgroundColor: props.palette.glow,
            border: `4px solid ${props.palette.accent}`,
            flexShrink: 0,
          },
        },
        cover,
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            maxWidth: "520px",
          },
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              fontFamily: "Outfit",
              fontSize: "20px",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: props.palette.muted,
            },
          },
          SITE_NAME,
        ),
        h(
          "div",
          {
            style: {
              display: "flex",
              marginTop: "20px",
              fontFamily: "Syne",
              fontSize: `${size}px`,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
            },
          },
          props.title,
        ),
        h("div", {
          style: {
            display: "flex",
            width: "120px",
            height: "8px",
            backgroundColor: props.palette.accent,
            marginTop: "28px",
          },
        }),
      ),
    ),
  );
}

export async function renderOgImage(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = parseOgSearch(url.searchParams);
  const origin = `${url.protocol}//${url.host}`;

  let element: ReactElement = DefaultCard();
  let trackCard: { title: string; palette: OgPalette } | null = null;
  // `?mix=` is recognised so the URL stays stable; mix cards land later.
  if (parsed.kind === "track" && parsed.slug) {
    const track = trackBySlug(parsed.slug);
    if (track) {
      const mood = moodForSlug(track.slug);
      trackCard = { title: track.title, palette: MOOD_PALETTES[mood] };
      const cover = await coverSrc(track.slug, origin);
      element = TrackCard({ ...trackCard, cover });
    }
  }

  try {
    return await pngResponse(element, request.method);
  } catch {
    // Bad cover bytes (SSO HTML mistaken for JPEG) — still emit a card.
    const fallback = trackCard ? TrackCard({ ...trackCard, cover: null }) : DefaultCard();
    return pngResponse(fallback, request.method);
  }
}

async function pngResponse(element: ReactElement, method: string): Promise<Response> {
  // Buffer the PNG. ImageResponse's stream is dropped by Nitro ESM, and
  // @vercel/og 1.x's node entry crashes here (harfbuzz `require("fs")`).
  const image = new ImageResponse(element, {
    ...OG_IMAGE_SIZE,
    fonts: ogFonts(),
  });
  const body = await image.arrayBuffer();
  const headers = new Headers(PNG_HEADERS);
  headers.set("Content-Length", String(body.byteLength));
  if (method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }
  return new Response(body, { status: 200, headers });
}
