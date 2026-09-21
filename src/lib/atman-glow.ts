export type AtmanGlowMode = "idle" | "sounding" | "live";

export type AtmanGlowInput = {
  playing: boolean;
  playPending: boolean;
  hasWave: boolean;
  sample: number;
  nowMs: number;
  reduceMotion?: boolean;
};

export type AtmanGlow = {
  mode: AtmanGlowMode;
  level: number;
};

function clamp01(n: number) {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * ATMAN lockup light. Idle CSS can breathe on its own. Once a tablet is
 * sounding, the level must keep moving even if the waveform or elapsed
 * clock never arrives — iOS often stalls both.
 */
export function atmanGlow(input: AtmanGlowInput): AtmanGlow {
  const sounding = input.playing || input.playPending;
  if (input.reduceMotion) {
    if (!sounding) return { mode: "idle", level: 0.16 };
    return {
      mode: input.hasWave ? "live" : "sounding",
      level: 0.42,
    };
  }

  const pulse = 0.5 + 0.5 * Math.sin(input.nowMs / 680);
  if (!sounding) {
    return { mode: "idle", level: 0 };
  }

  if (!input.hasWave) {
    return { mode: "sounding", level: clamp01(0.4 + pulse * 0.42) };
  }

  const sample = clamp01(input.sample);
  return {
    mode: "live",
    level: clamp01(0.18 + sample * 0.62 + pulse * 0.2),
  };
}
