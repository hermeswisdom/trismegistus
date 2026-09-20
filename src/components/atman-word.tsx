import { useEffect } from "react";
import { usePlayer } from "@/lib/player-store";
import { getTrack } from "@/lib/rooms";
import { getLiveWidget } from "@/lib/sc-widget";
import { hydrateWaveform, sampleWave, useWaveform, waveBars } from "@/lib/waveform";
import { cn } from "@/lib/utils";

const BAR_COUNT = 36;

export function AtmanWord({
  align = "center",
  as: Tag = "span",
}: {
  align?: "center" | "start";
  as?: "span" | "h1";
}) {
  const playing = usePlayer((s) => s.playing);
  const elapsed = usePlayer((s) => s.elapsed);
  const duration = usePlayer((s) => s.duration);
  const currentId = usePlayer((s) => s.currentId);
  const soundId = getTrack(currentId)?.soundId;
  const wave = useWaveform(soundId);
  const live = Boolean(playing && wave && duration > 0);
  const level = live && wave ? sampleWave(wave, elapsed, duration) : 0;
  const bars = wave ? waveBars(wave, BAR_COUNT, elapsed, duration) : null;

  useEffect(() => {
    const widget = getLiveWidget();
    if (widget) hydrateWaveform(widget);
  }, [soundId, playing]);

  return (
    <Tag
      className={cn("hermes-word", align === "start" && "hermes-word-start")}
      aria-label="Atman Music"
    >
      <span
        className={cn("atman-core", live && "is-live")}
        data-word="ATMAN"
        aria-hidden="true"
        style={{ ["--atman-level" as string]: live ? level : 0 }}
      >
        ATMAN
      </span>
      {live && bars ? (
        <span className="atman-meter" aria-hidden="true">
          {bars.map((bar, i) => (
            <span
              key={i}
              className={cn(bar.now && live && "is-now")}
              style={{ ["--v" as string]: bar.v }}
            />
          ))}
        </span>
      ) : null}
      <span className="atman-music" aria-hidden="true">
        MUSIC
      </span>
    </Tag>
  );
}
