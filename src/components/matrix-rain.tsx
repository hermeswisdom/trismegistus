import { useEffect, useRef } from "react";
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
  if (Math.random() < noteBias) return { n: true, ch: "" };
  if (Math.random() < 0.22) {
    return { n: false, ch: HEX[(Math.random() * HEX.length) | 0] };
  }
  return { n: false, ch: KATA[(Math.random() * KATA.length) | 0] };
}

function makeCol(
  i: number,
  n: number,
  height: number,
  compact: boolean,
  recycle: boolean,
): Col {
  const mid = Math.max(n - 1, 1) / 2;
  const dist = Math.abs(i - mid) / mid;
  const center = 1.35 - dist * 0.85;
  const len = compact
    ? 6 + (i % 5)
    : Math.max(12, Math.round((18 + Math.random() * 22) * (1.2 - dist * 0.45)));
  return {
    y: recycle ? -Math.random() * 120 : Math.random() * height,
    speed: (compact ? 1.1 : 0.9 + Math.random() * 1.7) * Math.max(0.45, center),
    cells: Array.from({ length: len }, () => cell(0.38)),
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
    let cellW = compact ? 7 : 14;
    let width = 0;
    let height = 0;
    let visible = true;
    let running = true;

    const styles = getComputedStyle(surface);
    const accent = styles.getPropertyValue("--color-accent").trim() || "#d6e24a";
    const fg = styles.getPropertyValue("--color-fg").trim() || "#f4efe4";

    function paint(step: boolean) {
      const fast = playingRef.current;
      const noteBias = fast ? 0.5 : 0.36;
      const mul = step ? (fast ? 1.85 : 1) : 0;
      const font = `${compact ? 8 : 13}px ui-monospace, "SF Mono", Menlo, monospace`;

      gfx.clearRect(0, 0, width, height);
      gfx.textAlign = "center";
      gfx.textBaseline = "top";

      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const x = (i + 0.5) * cellW;
        col.y += col.speed * mul;

        const trail = col.cells.length * cellW;
        if (step && col.y - trail > height + cellW) {
          cols[i] = makeCol(i, cols.length, height, compact, true);
          continue;
        }

        if (step && Math.random() < 0.12) col.cells[0] = cell(noteBias);

        for (let t = 0; t < col.cells.length; t++) {
          const gy = col.y - t * cellW;
          if (gy < -cellW || gy > height) continue;
          const item = col.cells[t];
          const fade = 1 - t / col.cells.length;
          if (t === 0) {
            gfx.fillStyle = fg;
            gfx.globalAlpha = 1;
            gfx.shadowColor = accent;
            gfx.shadowBlur = compact ? 4 : 12;
          } else {
            gfx.shadowBlur = 0;
            gfx.fillStyle = accent;
            gfx.globalAlpha = fade * (item.n ? 0.95 : 0.78);
          }
          if (item.n) {
            drawNote(gfx, x, gy, compact ? 9 : t === 0 ? 17 : 14);
          } else {
            gfx.font = font;
            gfx.fillText(item.ch, x, gy);
          }
        }
        gfx.shadowBlur = 0;
        gfx.globalAlpha = 1;
      }
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = host.clientWidth;
      height = host.clientHeight;
      surface.width = Math.max(1, Math.floor(width * dpr));
      surface.height = Math.max(1, Math.floor(height * dpr));
      surface.style.width = `${width}px`;
      surface.style.height = `${height}px`;
      gfx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cellW = compact ? 7 : 14;
      const n = Math.max(3, Math.floor(width / cellW));
      cols = Array.from({ length: n }, (_, i) =>
        makeCol(i, n, height, compact, false),
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
        visible = entry.isIntersecting;
      },
      { threshold: 0.02 },
    );
    io.observe(surface);

    function tick() {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden || !activeRef.current) return;
      paint(true);
    }

    resize();
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [compact]);

  return (
    <canvas
      ref={ref}
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      aria-hidden="true"
    />
  );
}
