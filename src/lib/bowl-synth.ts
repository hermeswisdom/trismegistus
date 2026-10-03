/**
 * Singing-bowl voice, synthesized in the browser.
 *
 * Not a bare sine: each sitting is a cluster of slightly inharmonic partials
 * (the way a real bronze bowl splits its modes), a pair of beating oscillators
 * per partial, a filtered strike, a long decay into a quiet rubbed sustain,
 * and a soft re-strike so a long listen does not die out.
 *
 * No samples, no third-party audio, no license file. The graph is built at
 * play time from the plan below.
 */
import { type Bowl } from "./bowls.ts";

export type BowlPartial = {
  ratio: number;
  gain: number;
  decaySec: number;
  beatHz: number;
  pan: number;
};

export type BowlVoicePlan = {
  fundamental: number;
  partials: BowlPartial[];
  strikeHz: number;
  strikeSec: number;
  strikeGain: number;
  sustain: number;
  restrikeSec: number;
  binaural: { leftHz: number; rightHz: number; beatHz: number } | null;
  reverbDelays: number[];
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Measured-style inharmonic ratios for a Tibetan bowl (modes 2,0 through 6,0
 * sit near 1 : 2.7 : 5 : 8 : 11.5), plus a sub-octave body tone.
 */
export function planBowlVoice(bowl: Bowl): BowlVoicePlan {
  const f = bowl.carrierHz;
  const ring = clamp(24 * (180 / Math.max(f, 55)), 12, 38);
  const bright = f >= 500 ? 1.15 : f >= 280 ? 1 : 0.88;
  const deep = f < 150 ? 1.12 : 1;

  const partials: BowlPartial[] = [
    { ratio: 1, gain: 0.5 * deep, decaySec: ring, beatHz: 0.16, pan: -0.08 },
    {
      ratio: 2.68,
      gain: 0.3 * bright,
      decaySec: ring * 0.74,
      beatHz: 0.28,
      pan: 0.18,
    },
    {
      ratio: 4.92,
      gain: 0.16 * bright,
      decaySec: ring * 0.5,
      beatHz: 0.41,
      pan: -0.22,
    },
    {
      ratio: 8.05,
      gain: 0.085 * bright,
      decaySec: ring * 0.34,
      beatHz: 0.58,
      pan: 0.3,
    },
    {
      ratio: 11.4,
      gain: 0.042 * bright,
      decaySec: ring * 0.22,
      beatHz: 0.77,
      pan: -0.34,
    },
    {
      ratio: 15.2,
      gain: 0.02 * bright,
      decaySec: ring * 0.14,
      beatHz: 1.05,
      pan: 0.12,
    },
    {
      ratio: 0.5,
      gain: f < 400 ? 0.14 : 0.05,
      decaySec: ring * 1.15,
      beatHz: 0.08,
      pan: 0,
    },
  ];

  const binaural =
    bowl.voice === "binaural" && bowl.beatHz
      ? {
          leftHz: bowl.carrierHz,
          rightHz: bowl.carrierHz + bowl.beatHz,
          beatHz: bowl.beatHz,
        }
      : null;

  return {
    fundamental: f,
    partials,
    strikeHz: clamp(f * 3.4, 420, 4200),
    strikeSec: f < 140 ? 0.09 : 0.055,
    strikeGain: 0.22,
    sustain: 0.34,
    restrikeSec: clamp(ring * 0.42, 7.5, 13),
    binaural,
    reverbDelays: [0.17, 0.29, 0.43],
  };
}

type LiveGraph = {
  nodes: AudioNode[];
  oscillators: OscillatorNode[];
  sources: AudioBufferSourceNode[];
  timers: number[];
  master: GainNode;
};

function noiseBuffer(
  ctx: AudioContext,
  seconds: number,
  kind: "white" | "brown",
) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      if (kind === "brown") {
        last = (last + 0.02 * white) / 1.02;
        data[i] = clamp(last * 3.5, -1, 1);
      } else {
        data[i] = white;
      }
    }
  }
  return buffer;
}

function AudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

class BowlEngine {
  ctx: AudioContext | null = null;
  output: GainNode | null = null;
  private graph: LiveGraph | null = null;
  private volume = 0.48;
  private playing = false;

  private ensure() {
    if (this.ctx && this.output) return this.ctx;
    const Ctor = AudioContextCtor();
    if (!Ctor) throw new Error("Web Audio is not available");
    const ctx = new Ctor();
    const output = ctx.createGain();
    output.gain.value = this.volume;
    output.connect(ctx.destination);
    this.ctx = ctx;
    this.output = output;
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (
          document.visibilityState === "visible" &&
          this.playing &&
          ctx.state === "suspended"
        ) {
          void ctx.resume();
        }
      });
    }
    return ctx;
  }

  isPlaying() {
    return this.playing;
  }

  unlock() {
    const ctx = this.ensure();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  setVolume(value: number) {
    this.volume = clamp(value, 0, 1);
    const ctx = this.ctx;
    if (this.output && ctx) {
      this.output.gain.cancelScheduledValues(ctx.currentTime);
      this.output.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.04);
    }
  }

  stop(fadeSec = 0.45, notify = true) {
    const ctx = this.ctx;
    const graph = this.graph;
    if (!graph || !ctx) {
      this.playing = false;
      return;
    }
    const now = ctx.currentTime;
    graph.master.gain.cancelScheduledValues(now);
    graph.master.gain.setTargetAtTime(0.0001, now, Math.max(0.04, fadeSec / 3));
    for (const id of graph.timers) window.clearInterval(id);
    const halt = now + fadeSec + 0.05;
    for (const osc of graph.oscillators) {
      try {
        osc.stop(halt);
      } catch {
        /* already stopped */
      }
    }
    for (const src of graph.sources) {
      try {
        src.stop(halt);
      } catch {
        /* already stopped */
      }
    }
    const leftover = graph.nodes;
    window.setTimeout(
      () => {
        leftover.forEach((node) => {
          try {
            node.disconnect();
          } catch {
            /* ignore */
          }
        });
      },
      Math.ceil((fadeSec + 0.15) * 1000),
    );
    this.graph = null;
    this.playing = false;
    if (notify) notifyBowlStopped();
  }

  play(bowl: Bowl) {
    const ctx = this.unlock();
    this.stop(0.18, false);
    if (!this.output) return;

    const plan = planBowlVoice(bowl);
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(this.output);

    const nodes: AudioNode[] = [master];
    const oscillators: OscillatorNode[] = [];
    const sources: AudioBufferSourceNode[] = [];
    const timers: number[] = [];
    const sustainGains: GainNode[] = [];

    const wet = ctx.createGain();
    wet.gain.value = 0.38;
    wet.connect(master);
    nodes.push(wet);

    for (const time of plan.reverbDelays) {
      const delay = ctx.createDelay(1.2);
      delay.delayTime.value = time;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.22;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2400;
      delay.connect(lp);
      lp.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      nodes.push(delay, feedback, lp);
    }

    const connectVoice = (node: AudioNode, pan: number) => {
      if (plan.binaural) {
        node.connect(master);
        return;
      }
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      node.connect(panner);
      panner.connect(master);
      panner.connect(wet);
      nodes.push(panner);
    };

    const startPartial = (
      freq: number,
      partial: BowlPartial,
      side: "left" | "right" | "mid",
      peakScale: number,
    ) => {
      const now = ctx.currentTime;
      const g = ctx.createGain();
      const peak = partial.gain * peakScale;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + 0.012);
      g.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, peak * plan.sustain),
        now + 1.8,
      );
      sustainGains.push(g);

      const mergerNeeded = side !== "mid";
      let dest: AudioNode = g;
      if (mergerNeeded) {
        const merger = ctx.createChannelMerger(2);
        const split = ctx.createGain();
        g.connect(split);
        if (side === "left") split.connect(merger, 0, 0);
        else split.connect(merger, 0, 1);
        merger.connect(master);
        merger.connect(wet);
        dest = g;
        nodes.push(merger, split);
      } else {
        connectVoice(g, partial.pan);
      }

      for (const sign of [-1, 1] as const) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = Math.max(20, freq + sign * (partial.beatHz / 2));
        osc.connect(dest);
        osc.start(now);
        oscillators.push(osc);
        nodes.push(osc);
      }
      nodes.push(g);
    };

    const strike = (gainScale: number) => {
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, plan.strikeSec + 0.04, "white");
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = plan.strikeHz;
      bp.Q.value = 1.1;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 180;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, plan.strikeGain * gainScale),
        now + 0.006,
      );
      g.gain.exponentialRampToValueAtTime(0.0001, now + plan.strikeSec);
      src.connect(hp);
      hp.connect(bp);
      bp.connect(g);
      g.connect(master);
      g.connect(wet);
      src.start(now);
      src.stop(now + plan.strikeSec + 0.02);
      sources.push(src);
      nodes.push(src, bp, hp, g);
    };

    const excite = (scale: number) => {
      if (plan.binaural) {
        for (const partial of plan.partials) {
          // Keep the named beat on the body tones; higher partials stay shared
          // so the pulse does not widen into a chorus.
          if (partial.ratio <= 1) {
            startPartial(
              plan.binaural.leftHz * partial.ratio,
              partial,
              "left",
              scale,
            );
            startPartial(
              plan.binaural.rightHz * partial.ratio,
              partial,
              "right",
              scale,
            );
          } else {
            const mid =
              ((plan.binaural.leftHz + plan.binaural.rightHz) / 2) *
              partial.ratio;
            startPartial(mid, partial, "mid", scale * 0.75);
          }
        }
      } else {
        for (const partial of plan.partials) {
          startPartial(plan.fundamental * partial.ratio, partial, "mid", scale);
        }
      }
      strike(scale);
    };

    excite(1);

    const rub = ctx.createBufferSource();
    rub.buffer = noiseBuffer(ctx, 4, "brown");
    rub.loop = true;
    const rubFilter = ctx.createBiquadFilter();
    rubFilter.type = "bandpass";
    rubFilter.frequency.value = clamp(plan.fundamental * 2.2, 140, 1400);
    rubFilter.Q.value = 2.4;
    const rubGain = ctx.createGain();
    rubGain.gain.value = 0.018;
    const rubLfo = ctx.createOscillator();
    rubLfo.type = "sine";
    rubLfo.frequency.value = 0.13;
    const rubLfoGain = ctx.createGain();
    rubLfoGain.gain.value = 0.008;
    rubLfo.connect(rubLfoGain);
    rubLfoGain.connect(rubGain.gain);
    rub.connect(rubFilter);
    rubFilter.connect(rubGain);
    rubGain.connect(master);
    rub.start();
    rubLfo.start();
    sources.push(rub);
    oscillators.push(rubLfo);
    nodes.push(rub, rubFilter, rubGain, rubLfo, rubLfoGain);

    timers.push(
      window.setInterval(() => {
        if (!this.playing) return;
        strike(0.32);
        const now = ctx.currentTime;
        for (const g of sustainGains) {
          const current = Math.max(0.0002, g.gain.value);
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(current, now);
          g.gain.exponentialRampToValueAtTime(
            Math.min(1, current * 1.55),
            now + 0.02,
          );
          g.gain.exponentialRampToValueAtTime(current, now + 1.6);
        }
      }, plan.restrikeSec * 1000),
    );

    this.graph = { nodes, oscillators, sources, timers, master };
    this.playing = true;
  }
}

let engine: BowlEngine | null = null;
const stopListeners = new Set<() => void>();

function notifyBowlStopped() {
  stopListeners.forEach((fn) => fn());
}

export function onBowlGraphStopped(fn: () => void) {
  stopListeners.add(fn);
  return () => {
    stopListeners.delete(fn);
  };
}

export function getBowlEngine() {
  if (typeof window === "undefined") return null;
  if (!engine) engine = new BowlEngine();
  return engine;
}

export function hushBowlGraph(fadeSec = 0.35) {
  engine?.stop(fadeSec);
}

export function bowlGraphPlaying() {
  return engine?.isPlaying() ?? false;
}
