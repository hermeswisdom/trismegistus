import { useEffect, useRef } from "react";
import { getEngine } from "@/lib/audio-engine";
import { usePlayer } from "@/lib/player-store";

export function Visualizer() {
  const pathRef = useRef<SVGPathElement>(null);
  const playing = usePlayer((s) => s.playing);

  useEffect(() => {
    let raf = 0;
    let buffer = new Uint8Array(1024);
    const width = 1000;
    const height = 80;

    const draw = () => {
      const path = pathRef.current;
      if (!path) {
        raf = window.requestAnimationFrame(draw);
        return;
      }
      const analyser = getEngine()?.getAnalyser();
      if (analyser) {
        if (buffer.length !== analyser.fftSize) {
          buffer = new Uint8Array(analyser.fftSize);
        }
        if (playing) analyser.getByteTimeDomainData(buffer);
        else buffer.fill(128);
      } else {
        buffer.fill(128);
      }

      const mid = height / 2;
      const last = buffer.length - 1;
      const breathe = playing ? 1 : 0.12;
      let d = "";
      for (let i = 0; i < buffer.length; i += 1) {
        const x = (i / last) * width;
        const v = ((buffer[i] ?? 128) - 128) / 128;
        const y = mid + v * mid * 0.86 * breathe;
        d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
      }
      path.setAttribute("d", d);
      raf = window.requestAnimationFrame(draw);
    };

    draw();
    return () => window.cancelAnimationFrame(raf);
  }, [playing]);

  return (
    <svg
      viewBox="0 0 1000 80"
      className="h-16 w-full sm:h-20"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path
        ref={pathRef}
        fill="none"
        stroke="rgb(200 204 212 / 0.72)"
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
