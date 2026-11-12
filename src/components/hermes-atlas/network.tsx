import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  CORE_NAMES,
  EDGES,
  ENTRIES,
  GROUPS,
  GROUP_PALETTE,
  PERIODS,
  TRADITION_NAMES,
  entryById,
  layerOf,
  primaryTradition,
  type Entry,
} from "@/lib/hermes-atlas";
import { AtlasButton } from "./primitives";
import { atlasTheme } from "./theme";

type Point = { id: string; x: number; y: number };
type View = { x: number; y: number; z: number };

function groupFill(group: string): string {
  const index = GROUPS.indexOf(group as (typeof GROUPS)[number]);
  return GROUP_PALETTE[(index < 0 ? 0 : index) % GROUP_PALETTE.length]!;
}

export function Network({
  selected,
  select,
  allowed,
  mode,
  offset,
  period,
  labels,
  resetKey,
  linkType,
  focusKey,
  hoverEnabled,
  onTapPreview,
}: {
  selected: string;
  select: (id: string) => void;
  allowed: string[];
  mode: string;
  offset: number;
  period: number;
  labels: boolean;
  resetKey: number;
  linkType: string;
  focusKey: number;
  hoverEnabled: boolean;
  onTapPreview?: (id: string | null) => void;
}) {
  const el = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 490 });
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 1 });
  const [hover, setHover] = useState<string | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef({ x: 0, y: 0, moved: false, pinch: 0 });
  const current = useRef<Point[]>([]);

  const allowedKey = allowed.join("|");
  const allow = new Set(allowed);
  const adjacent = EDGES.filter(
    (edge) =>
      (edge.a === selected || edge.b === selected) &&
      (linkType === "All connections" || edge.type === linkType),
  )
    .map((edge) => (edge.a === selected ? edge.b : edge.a))
    .filter((id) => allow.has(id));
  const neighbours = Array.from(new Set(adjacent)).sort((a, b) => {
    const rank = (id: string) => (CORE_NAMES as readonly string[]).indexOf(id);
    const ra = rank(a);
    const rb = rank(b);
    return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
  });
  const ids =
    mode === "Whole atlas"
      ? ENTRIES.filter((entry) => allow.has(entry.id) || entry.id === selected).map((entry) => entry.id)
      : [selected, ...neighbours.slice(offset, offset + 12)];

  const points: Point[] = ids.map((id, i) => {
    if (mode !== "Whole atlas") {
      if (i === 0) return { id, x: 0, y: 0 };
      const angle = ((i - 1) * Math.PI * 2) / Math.max(1, ids.length - 1) - Math.PI / 2;
      return { id, x: Math.cos(angle) * 285, y: Math.sin(angle) * 220 };
    }
    if (id === "hermes") {
      const g = TRADITION_NAMES.indexOf("Greek");
      return { id, x: (g % 4) * 700 - 1050 - 315, y: Math.floor(g / 4) * 580 - 1100 };
    }
    const entry = entryById(id);
    const key = primaryTradition(entry);
    const g = (TRADITION_NAMES as readonly string[]).indexOf(key);
    const members = ENTRIES.filter((item) => primaryTradition(item) === key && item.id !== "hermes");
    const j = members.findIndex((item) => item.id === id);
    return {
      id,
      x: (g % 4) * 700 - 1050 + (j % 5) * 105 - 210,
      y: Math.floor(g / 4) * 580 - 1100 + Math.floor(j / 5) * 80,
    };
  });
  const xs = points.length ? points.map((p) => p.x) : [0];
  const ys = points.length ? points.map((p) => p.y) : [0];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centre = mode === "Whole atlas" ? { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } : { x: 0, y: 0 };
  const fit = Math.min(
    size.w / (mode === "Whole atlas" ? Math.max(480, maxX - minX + 300) : 780),
    size.h / (mode === "Whole atlas" ? Math.max(400, maxY - minY + 220) : 620),
  );
  const at = (p: Point) => ({
    x: size.w / 2 + (p.x - centre.x) * fit * view.z + view.x,
    y: size.h / 2 + (p.y - centre.y) * fit * view.z + view.y,
  });

  useEffect(() => {
    if (mode !== "Whole atlas") setView({ x: 0, y: 0, z: 1 });
    setHover(null);
  }, [selected, mode, offset, allowedKey, linkType]);

  useEffect(() => {
    setView({ x: 0, y: 0, z: 1 });
    setHover(null);
  }, [mode, resetKey, allowedKey]);

  useEffect(() => {
    if (mode !== "Whole atlas" || focusKey === 0) return;
    const p = points.find((item) => item.id === selected);
    if (p) {
      const z = 2.5;
      setView({ x: -(p.x - centre.x) * fit * z, y: -(p.y - centre.y) * fit * z, z });
    }
    // Focus only when the caller bumps focusKey (opening a named figure).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => {
      const width = node.clientWidth;
      const phone = width < 720;
      setSize({
        w: width,
        h: Math.min(phone ? 420 : 560, Math.max(phone ? 280 : 390, width * (phone ? 0.88 : 0.62))),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = el.current;
    if (!canvas) return;
    const d = window.devicePixelRatio || 1;
    canvas.width = size.w * d;
    canvas.height = size.h * d;
    const c = canvas.getContext("2d");
    if (!c) return;
    c.setTransform(d, 0, 0, d, 0, 0);
    c.fillStyle = atlasTheme.bg;
    c.fillRect(0, 0, size.w, size.h);
    for (let i = 0; i < 90; i++) {
      const x = (i * 137.19) % size.w;
      const y = (i * 79.37) % size.h;
      c.fillStyle = i % 7 === 0 ? atlasTheme.accent : "#6e675c";
      c.globalAlpha = 0.45;
      c.beginPath();
      c.arc(x, y, i % 7 === 0 ? 1.2 : 0.65, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    c.strokeStyle = "rgb(214 226 74 / 12%)";
    c.lineWidth = 1;
    [0.22, 0.38, 0.48].forEach((r) => {
      c.beginPath();
      c.arc(size.w / 2 + view.x, size.h / 2 + view.y, Math.min(size.w, size.h) * r * view.z, 0, Math.PI * 2);
      c.stroke();
    });
    if (mode === "Whole atlas") {
      TRADITION_NAMES.forEach((label, g) => {
        if (!points.some((p) => primaryTradition(entryById(p.id)) === label)) return;
        const pos = at({ id: "", x: (g % 4) * 700 - 1050, y: Math.floor(g / 4) * 580 - 1155 });
        c.font = "600 12px Outfit, sans-serif";
        c.textAlign = "center";
        c.fillStyle = atlasTheme.accent;
        c.fillText(label, pos.x, pos.y);
      });
    }
    const map = new Map(points.map((p) => [p.id, p]));
    EDGES.forEach((edge) => {
      if (linkType !== "All connections" && edge.type !== linkType) return;
      const a = map.get(edge.a);
      const b = map.get(edge.b);
      if (!a || !b) return;
      const aa = at(a);
      const bb = at(b);
      const active = edge.a === selected || edge.b === selected;
      c.strokeStyle = active ? atlasTheme.accent : "rgb(244 239 228 / 28%)";
      c.globalAlpha = active ? 0.8 : 0.22;
      c.lineWidth = active ? 1.5 : 1;
      c.setLineDash(edge.type === "Parallel only" ? [3, 6] : edge.type === "Traditional identification" ? [10, 5] : []);
      c.beginPath();
      c.moveTo(aa.x, aa.y);
      c.lineTo(bb.x, bb.y);
      c.stroke();
    });
    c.setLineDash([]);
    c.globalAlpha = 1;
    points.forEach((p) => {
      const n = entryById(p.id);
      const pos = at(p);
      const chosen = p.id === selected;
      const major = (CORE_NAMES as readonly string[]).includes(p.id);
      const lit =
        chosen ||
        period < 0 ||
        (n.year !== null && n.year >= PERIODS[period]!.range[0]! && n.year <= PERIODS[period]!.range[1]!);
      c.globalAlpha = lit ? 1 : 0.2;
      const r = chosen ? 17 : major ? 13 : mode === "Whole atlas" ? 7 : 10;
      c.fillStyle = groupFill(n.group);
      c.strokeStyle = chosen ? "#fff8c8" : atlasTheme.bg;
      c.lineWidth = chosen ? 3 : 2;
      c.beginPath();
      c.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      if (chosen) {
        c.strokeStyle = atlasTheme.accent;
        c.lineWidth = 1;
        c.beginPath();
        c.arc(pos.x, pos.y, 23, 0, Math.PI * 2);
        c.stroke();
      }
      if (labels || chosen) {
        const first = n.id === "idris" ? "IDRIS" : n.name.split(" · ")[0]!.split(" / ")[0]!;
        const words = first.length > 21 ? first.split(" ") : [first];
        const lines =
          words.length > 1 && first.length > 21
            ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")]
            : [first];
        c.font = `${chosen || major ? "600" : "400"} ${chosen ? 15 : major ? 14 : 12}px Outfit, sans-serif`;
        c.textAlign = "center";
        c.textBaseline = "top";
        lines.forEach((line, j) => {
          const width = c.measureText(line).width;
          c.fillStyle = atlasTheme.bg;
          const labelX = Math.max(width / 2 + 5, Math.min(size.w - width / 2 - 5, pos.x));
          c.fillRect(labelX - width / 2 - 3, pos.y + r + 6 + j * 15, width + 6, 15);
          c.fillStyle = chosen || major ? "#ffe7ae" : atlasTheme.text.primary;
          c.fillText(line, labelX, pos.y + r + 6 + j * 15);
        });
      }
    });
    c.globalAlpha = 1;
    current.current = points;
    // points/at are derived from the listed inputs; redrawing on every render
    // would loop the canvas without changing the picture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, view, selected, mode, offset, allowedKey, period, labels, linkType]);

  useEffect(() => {
    const canvas = el.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setView((v) => ({ ...v, z: Math.min(5, Math.max(0.5, v.z * (event.deltaY < 0 ? 1.12 : 0.89))) }));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  function hit(x: number, y: number, radius: number): string {
    let best = "";
    let dist = radius;
    current.current.forEach((p) => {
      const pos = at(p);
      const d = Math.hypot(x - pos.x, y - pos.y);
      if (d < dist) {
        best = p.id;
        dist = d;
      }
    });
    return best;
  }

  function down(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.nativeEvent.pointerId);
    pointers.current.set(event.nativeEvent.pointerId, { x: event.clientX, y: event.clientY });
    drag.current = { x: event.clientX, y: event.clientY, moved: false, pinch: 0 };
    if (pointers.current.size === 2) {
      const a = Array.from(pointers.current.values());
      drag.current.pinch = Math.hypot(a[0]!.x - a[1]!.x, a[0]!.y - a[1]!.y);
    }
  }

  function move(event: ReactPointerEvent<HTMLCanvasElement>) {
    const id = event.nativeEvent.pointerId;
    if (!pointers.current.has(id)) {
      if (!hoverEnabled) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const best = hit(event.clientX - rect.left, event.clientY - rect.top, 24);
      setHover(best || null);
      return;
    }
    const prev = pointers.current.get(id)!;
    pointers.current.set(id, { x: event.clientX, y: event.clientY });
    if (Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) > 5) {
      drag.current.moved = true;
    }
    if (pointers.current.size === 2) {
      const a = Array.from(pointers.current.values());
      const dist = Math.hypot(a[0]!.x - a[1]!.x, a[0]!.y - a[1]!.y);
      if (drag.current.pinch > 0) {
        const ratio = dist / drag.current.pinch;
        setView((v) => ({ ...v, z: Math.min(5, Math.max(0.5, v.z * ratio)) }));
      }
      drag.current.pinch = dist;
      drag.current.moved = true;
      return;
    }
    setView((v) => ({ ...v, x: v.x + event.clientX - prev.x, y: v.y + event.clientY - prev.y }));
  }

  function up(event: ReactPointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(event.nativeEvent.pointerId);
    if (!drag.current.moved) {
      const rect = event.currentTarget.getBoundingClientRect();
      const best = hit(event.clientX - rect.left, event.clientY - rect.top, 30);
      if (best) {
        select(best);
        if (!hoverEnabled) onTapPreview?.(best);
      }
    }
    drag.current.pinch = 0;
  }

  const previewId = hover;
  const preview: Entry | null = previewId ? entryById(previewId) : null;

  return (
    <div ref={box} className="min-w-0 w-full">
      <canvas
        ref={el}
        className="hermes-atlas-canvas block w-full touch-none rounded-2xl"
        style={{ height: size.h, cursor: "grab" }}
        aria-label="Interactive Hermes network. Drag to pan, pinch or scroll to zoom. Use the named selector for keyboard access."
        onPointerDown={down}
        onPointerMove={move}
        onPointerLeave={() => setHover(null)}
        onPointerUp={up}
        onPointerCancel={(event) => {
          pointers.current.delete(event.nativeEvent.pointerId);
          drag.current.moved = true;
        }}
      />
      {preview ? (
        <div role="status" className="border-b border-border py-3">
          <strong className="font-display text-fg">{preview.name}</strong>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{preview.summary}</p>
          <span className="mt-1 block text-xs text-subtle">
            {preview.group} · {layerOf(preview)}
          </span>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <AtlasButton label="Zoom +" onClick={() => setView((v) => ({ ...v, z: Math.min(5, v.z * 1.25) }))} />
        <AtlasButton label="Zoom −" onClick={() => setView((v) => ({ ...v, z: Math.max(0.5, v.z / 1.25) }))} />
        <AtlasButton label="Fit view" onClick={() => setView({ x: 0, y: 0, z: 1 })} />
      </div>
    </div>
  );
}
