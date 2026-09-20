import type { TrackSpec } from "@/lib/catalog";

function brownNoiseBuffer(ctx: AudioContext, seconds = 6) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = Math.max(-1, Math.min(1, last * 3.4));
    }
  }
  return buffer;
}

function impulseBuffer(ctx: AudioContext, duration = 2.6, decay = 2.8) {
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
    }
  }
  return buffer;
}

type LiveGraph = {
  nodes: AudioNode[];
  oscillators: OscillatorNode[];
  sources: AudioBufferSourceNode[];
  timers: number[];
};

export class VelumEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  analyser: AnalyserNode | null = null;
  private graph: LiveGraph | null = null;
  private volume = 0.78;
  private playing = false;

  private ensure() {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = this.volume;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.86;
    master.connect(analyser);
    analyser.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    this.analyser = analyser;
    return ctx;
  }

  getAnalyser() {
    return this.analyser;
  }

  isPlaying() {
    return this.playing;
  }

  async unlock() {
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
  }

  setVolume(value: number) {
    this.volume = value;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05);
    }
  }

  stop() {
    const ctx = this.ctx;
    if (!this.graph || !ctx || !this.master) {
      this.playing = false;
      return;
    }
    const now = ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0.0001, now, 0.08);
    for (const id of this.graph.timers) window.clearInterval(id);
    for (const osc of this.graph.oscillators) {
      try {
        osc.stop(now + 0.25);
      } catch {
        /* already stopped */
      }
    }
    for (const src of this.graph.sources) {
      try {
        src.stop(now + 0.25);
      } catch {
        /* already stopped */
      }
    }
    const leftover = this.graph.nodes;
    window.setTimeout(() => {
      leftover.forEach((n) => {
        try {
          n.disconnect();
        } catch {
          /* ignore */
        }
      });
    }, 400);
    this.graph = null;
    this.playing = false;
  }

  async play(spec: TrackSpec) {
    const ctx = this.ensure();
    await this.unlock();
    this.stop();
    if (!this.master) return;

    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.master.gain.exponentialRampToValueAtTime(this.volume, ctx.currentTime + 1.4);

    const nodes: AudioNode[] = [];
    const oscillators: OscillatorNode[] = [];
    const sources: AudioBufferSourceNode[] = [];
    const timers: number[] = [];

    const convolver = ctx.createConvolver();
    convolver.buffer = impulseBuffer(ctx);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = spec.reverbGain;
    convolver.connect(reverbGain);
    reverbGain.connect(this.master);
    nodes.push(convolver, reverbGain);

    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = spec.delayTime;
    const feedback = ctx.createGain();
    feedback.gain.value = spec.delayFeedback;
    const delayMix = ctx.createGain();
    delayMix.gain.value = 0.32;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(delayMix);
    delayMix.connect(this.master);
    delayMix.connect(convolver);
    nodes.push(delay, feedback, delayMix);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = spec.noiseCutoff + 200;
    filter.Q.value = 0.7;
    filter.connect(this.master);
    filter.connect(convolver);
    filter.connect(delay);
    nodes.push(filter);

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = spec.lfoRate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = spec.lfoDepth;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    oscillators.push(lfo);
    nodes.push(lfo, lfoGain);

    for (const drone of spec.drones) {
      const osc = ctx.createOscillator();
      osc.type = drone.type;
      osc.frequency.value = drone.freq;
      osc.detune.value = drone.detune;
      const g = ctx.createGain();
      g.gain.value = drone.gain;
      osc.connect(g);
      g.connect(filter);
      osc.start();
      oscillators.push(osc);
      nodes.push(osc, g);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = brownNoiseBuffer(ctx);
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = spec.noiseCutoff;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = spec.noiseGain;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(filter);
    noise.start();
    sources.push(noise);
    nodes.push(noise, noiseFilter, noiseGain);

    const fireTone = (
      freq: number,
      gain: number,
      type: OscillatorType,
      attack: number,
      release: number,
    ) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const now = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(gain, now + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);
      osc.connect(g);
      g.connect(filter);
      g.connect(convolver);
      osc.start(now);
      osc.stop(now + attack + release + 0.05);
    };

    if (spec.pulse) {
      const pulse = spec.pulse;
      fireTone(pulse.freq, pulse.gain, pulse.type, 0.08, 1.8);
      timers.push(
        window.setInterval(() => {
          if (this.playing) fireTone(pulse.freq, pulse.gain, pulse.type, 0.08, 1.8);
        }, pulse.interval),
      );
    }

    if (spec.sparkle) {
      const sparkle = spec.sparkle;
      timers.push(
        window.setInterval(() => {
          if (!this.playing) return;
          const freq = sparkle.freqs[Math.floor(Math.random() * sparkle.freqs.length)]!;
          fireTone(freq, sparkle.gain, "sine", 0.02, 2.2);
        }, sparkle.interval),
      );
    }

    this.graph = { nodes, oscillators, sources, timers };
    this.playing = true;
  }
}

let engine: VelumEngine | null = null;

export function getEngine() {
  if (typeof window === "undefined") return null;
  if (!engine) engine = new VelumEngine();
  return engine;
}
