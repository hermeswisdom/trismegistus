import { useEffect, useMemo } from "react";
import { useMarksFeed, EMPTY_MARKS } from "@/lib/marks-feed";
import { usePlayer } from "@/lib/player-store";
import type { TrackMark } from "@/lib/marks";
import { cn } from "@/lib/utils";

const LANES = 7;

function lanesFor(marks: TrackMark[], copies: number) {
  const pool = marks.slice(0, 16);
  if (pool.length === 0) return [];
  const out: { key: string; mark: TrackMark; lane: number; dur: number; delay: number }[] = [];
  for (let c = 0; c < copies; c++) {
    pool.forEach((mark, i) => {
      const lane = (mark.id + i + c * 3) % LANES;
      out.push({
        key: `${mark.id}-${c}-${i}`,
        mark,
        lane,
        dur: 16 + ((mark.id + i) % 9),
        delay: -((c * pool.length + i) * 2.4),
      });
    });
  }
  return out;
}

function DriftLine({
  mark,
  lane,
  dur,
  delay,
  compact,
}: {
  mark: TrackMark;
  lane: number;
  dur: number;
  delay: number;
  compact?: boolean;
}) {
  return (
    <p
      className={cn(
        "mark-drift absolute left-0 whitespace-nowrap will-change-transform",
        compact
          ? "mark-drift-tile text-xs tracking-wide text-fg/90"
          : "font-display text-lg text-fg drop-shadow-[0_1px_8px_rgb(9_8_14_/_80%)] sm:text-xl",
      )}
      style={{
        top: `${8 + lane * (compact ? 12 : 11)}%`,
        animationDuration: `${dur}s`,
        animationDelay: `${delay}s`,
      }}
    >
      <span className="text-accent">{mark.author}</span>
      <span className="mx-2 text-subtle">·</span>
      <span>{mark.body}</span>
    </p>
  );
}

export function ScreenMarkDrift() {
  const currentId = usePlayer((s) => s.currentId);
  const playing = usePlayer((s) => s.playing);
  const hydrate = useMarksFeed((s) => s.hydrate);
  const hydrateTrack = useMarksFeed((s) => s.hydrateTrack);
  const marks = useMarksFeed((s) => s.byTrack[currentId] ?? EMPTY_MARKS);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!currentId) return;
    void hydrateTrack(currentId);
  }, [currentId, hydrateTrack]);

  const lines = useMemo(
    () => lanesFor(marks, marks.length < 4 ? 3 : 1),
    [marks],
  );

  if (!playing || lines.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-16 bottom-28 z-30 overflow-hidden"
      aria-hidden="true"
    >
      {lines.map(({ key, ...line }) => (
        <DriftLine key={key} {...line} />
      ))}
    </div>
  );
}

export function TileMarkDrift({ trackId }: { trackId: string }) {
  const marks = useMarksFeed((s) => s.byTrack[trackId] ?? EMPTY_MARKS);
  const lines = useMemo(() => lanesFor(marks.slice(0, 4), 2), [marks]);
  if (lines.length === 0) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
      aria-hidden="true"
    >
      {lines.map(({ key, ...line }) => (
        <DriftLine key={key} {...line} compact />
      ))}
    </div>
  );
}
