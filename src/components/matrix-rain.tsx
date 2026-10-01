import { useEffect, useRef } from "react";
import {
  rainBudget,
  rainColumnFinished,
  rainSpawnY,
} from "@/lib/matrix-rain";
import { cn } from "@/lib/utils";

const KATA = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ";
const HEX = "0123456789ABCDEF<>/$";

type Cell = { n: boolean; ch: string };

type Col = {
  y: number;
  speed: number;
  cells: Cell[];
};

function cell(noteBias: number): Cell {
  if (Math.random() < noteBias) return { n: true, ch: "♪" };
  if (Math.random() < 0.22) {
    return { n: false, ch: HEX[(Math.random() * HEX.length) | 0] };
  }
  return { n: false, ch: KATA[(Math.random() * KATA.length) | 0] };
}

function fillCol(
  i: number,
  n: number,
  height: number,
  trail: number,
  compact: boolean,
  recycle: boolean,
): Col {
  const mid = Math.max(n - 1, 1) / 2;
  const dist = Math.abs(i - mid) / mid;
  const center = 1.2 - dist * 0.55;
  return {
    y: rainSpawnY(height, recycle),
    speed: (compact ? 0.9 : 0.7 + Math.random() * 1.1) * Math.max(0.4, center),
    cells: Array.from({ length: trail }, () => cell(0.32)),
  };
}

function drawNote(
  gfx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  const s = size / 16;
  gfx.save();
  gfx.translate(x, y);
  gfx.scale(s, s);
  gfx.rotate(-0.18);
  gfx.beginPath();
  gfx.ellipse(3.2, 13.4, 4.6, 3.2, -0.45, 0, Math.PI * 2);
  gfx.fill();
  gfx.fillRect(6.6, -1.2, 1.55, 15.2);
  gfx.beginPath();
  gfx.moveTo(8.15, -1.2);
  gfx.bezierCurveTo(15.5, 1.4, 16.2, 8.5, 13.2, 12.4);
  gfx.bezierCurveTo(11.4, 6.6, 9.6, 3.2, 8.15, 2.4);
  gfx.closePath();
  gfx.fill();
  gfx.restore();
}

export function MatrixRain({
  playing = false,
  compact = false,
  active = true,
  className,
}: {
  playing?: boolean;
  compact?: boolean;
  active?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const playingRef = useRef(playing);
  const activeRef = useRef(active);
  playingRef.current = playing;
  activeRef.current = active;

  useEffect(() => {
    const surfaceEl = ref.current;
    if (!surfaceEl) return;
    const hostEl = surfaceEl.parentElement;
    if (!hostEl) return;
    const ctx = surfaceEl.getContext("2d", { alpha: true });
    if (!ctx) return;
    const surface: HTMLCanvasElement = surfaceEl;
    const host: HTMLElement = hostEl;
    const gfx: CanvasRenderingContext2D = ctx;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionOff = reduce.matches;

    let raf = 0;
    let cols: Col[] = [];
    let cellW = compact ? 7 : 16;
    let trail = compact ? 5 : 10;
    let shadowBlur = 0;
    let simpleGlyphs = compact;
    let frameMs = 33;
    let noteBias = 0.32;
    let speedMul = 1;
    let width = 0;
    let height = 0;
    let visible = true;
    let running = true;
    let lastPaint = 0;

    const styles = getComputedStyle(surface);
    const accent = styles.getPropertyValue("--color-accent").trim() || "#d6e24a";
    const fg = styles.getPropertyValue("--color-fg").trim() || "#f4efe4";

    function paint(step: boolean) {
      const fast = playingRef.current;
      const bias = fast ? Math.max(noteBias, 0.46) : noteBias;
      const mul = step ? speedMul * (fast ? 1.35 : 1) : 0;
      const font = `${compact ? 8 : simpleGlyphs ? 11 : 13}px ui-monospace, "SF Mono", Menlo, monospace`;

      // Nothing to draw into until the host has a size (hidden gate, first
      // layout pass); the ResizeObserver repaints as soon as it gets one.
      if (width <= 0 || height <= 0 || cols.length === 0) return;
      gfx.clearRect(0, 0, width, height);
      gfx.textAlign = "center";
      gfx.textBaseline = "top";

      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const x = (i + 0.5) * cellW;
        col.y += col.speed * mul;

        if (step && rainColumnFinished(col.y, col.cells.length, cellW, height)) {
          cols[i] = fillCol(i, cols.length, height, trail, compact, true);
          continue;
        }

        if (step && Math.random() < 0.1) col.cells[0] = cell(bias);

        for (let t = 0; t < col.cells.length; t++) {
          const gy = col.y - t * cellW;
          if (gy < -cellW || gy > height) continue;
          const item = col.cells[t];
          const fade = 1 - t / col.cells.length;
          if (t === 0) {
            gfx.fillStyle = fg;
            gfx.globalAlpha = 1;
            gfx.shadowColor = accent;
            gfx.shadowBlur = shadowBlur;
          } else {
            gfx.shadowBlur = 0;
            gfx.fillStyle = accent;
            gfx.globalAlpha = fade * (item.n ? 0.9 : 0.7);
          }
          if (item.n && !simpleGlyphs) {
            drawNote(gfx, x, gy, compact ? 9 : t === 0 ? 16 : 13);
          } else {
            gfx.font = font;
            gfx.fillText(item.n ? "♪" : item.ch, x, gy);
          }
        }
        gfx.shadowBlur = 0;
        gfx.globalAlpha = 1;
      }
    }

    function resize() {
      const budget = rainBudget({
        width: host.clientWidth,
        height: host.clientHeight,
        compact,
        viewportWidth: window.innerWidth,
        playing: playingRef.current,
        reduceMotion: motionOff,
      });
      const dpr = Math.min(window.devicePixelRatio || 1, budget.maxDpr);
      width = host.clientWidth;
      height = host.clientHeight;
      surface.width = Math.max(1, Math.floor(width * dpr));
      surface.height = Math.max(1, Math.floor(height * dpr));
      surface.style.width = `${width}px`;
      surface.style.height = `${height}px`;
      surface.dataset.rainCols = String(budget.columns);
      surface.dataset.rainPhone = budget.simpleGlyphs ? "true" : "false";
      gfx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cellW = budget.cellW;
      trail = budget.trail;
      shadowBlur = budget.shadowBlur;
      simpleGlyphs = budget.simpleGlyphs;
      frameMs = budget.frameMs;
      noteBias = budget.noteBias;
      speedMul = budget.speed;
      cols = Array.from({ length: budget.columns }, (_, i) =>
        fillCol(i, budget.columns, height, trail, compact, false),
      );
      paint(false);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(host);

    if (motionOff) {
      resize();
      return () => ro.disconnect();
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        surface.dataset.rainPaused = visible ? "false" : "true";
      },
      { threshold: 0.04, rootMargin: "0px" },
    );
    io.observe(host);

    const onHide = () => {
      if (document.hidden) surface.dataset.rainPaused = "true";
    };
    document.addEventListener("visibilitychange", onHide);

    function tick(now: number) {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      const paused = !visible || document.hidden || !activeRef.current;
      surface.dataset.rainPaused = paused ? "true" : "false";
      if (paused) return;
      if (now - lastPaint < frameMs) return;
      lastPaint = now;
      paint(true);
    }

    resize();
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [compact]);

  return (
    <canvas
      ref={ref}
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      aria-hidden="true"
      data-rain=""
      data-rain-paused={active ? "false" : "true"}
    />
  );
}
