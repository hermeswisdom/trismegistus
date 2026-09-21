import { useEffect, useState } from "react";
import type { SCWidget } from "@/lib/sc-widget";

const cache = new Map<string, Float32Array>();
const inflight = new Map<string, Promise<Float32Array | null>>();
const failed = new Set<string>();
const hydrated = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function jsonUrl(url: string) {
  return url.replace(/\.png(\?.*)?$/i, ".json$1");
}

function pack(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.08)] ?? 0;
  const hi = sorted[Math.floor(sorted.length * 0.92)] ?? 1;
  const span = Math.max(1, hi - lo);
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = Math.min(1, Math.max(0, (samples[i] - lo) / span));
  }
  return out;
}

export async function loadWaveform(id: string, waveformUrl: string) {
  if (cache.has(id)) return cache.get(id) ?? null;
  if (failed.has(id)) return null;
  const pending = inflight.get(id);
  if (pending) return pending;
  const work = fetch(jsonUrl(waveformUrl), { mode: "cors" })
    .then(async (res) => {
      if (!res.ok) {
        failed.add(id);
        return null;
      }
      const data = (await res.json()) as { samples?: number[] };
      if (!data.samples?.length) {
        failed.add(id);
        return null;
      }
      const packed = pack(data.samples);
      cache.set(id, packed);
      notify();
      return packed;
    })
    .catch(() => {
      failed.add(id);
      return null;
    })
    .finally(() => inflight.delete(id));
  inflight.set(id, work);
  return work;
}

export function hydrateWaveform(widget: SCWidget) {
  try {
    widget.getCurrentSound((sound) => {
      try {
        if (!sound?.id || !sound.waveform_url) return;
        const id = String(sound.id);
        if (cache.has(id) || failed.has(id) || hydrated.has(id)) return;
        hydrated.add(id);
        void loadWaveform(id, sound.waveform_url);
      } catch {
        /* SoundCloud's canvas createPattern can throw while the widget draws. */
      }
    });
  } catch {
    /* widget not ready yet, or InvalidStateError inside the embed */
  }
}

export function sampleWave(samples: Float32Array, elapsed: number, duration: number) {
  if (duration <= 0 || samples.length === 0) return 0;
  const x = Math.min(0.999, Math.max(0, elapsed / duration)) * (samples.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = samples[i] ?? 0;
  const b = samples[Math.min(samples.length - 1, i + 1)] ?? a;
  return a * (1 - f) + b * f;
}

export function waveBars(
  samples: Float32Array,
  count: number,
  elapsed: number,
  duration: number,
) {
  const bars = new Array<{ v: number; now: boolean }>(count);
  const head = duration > 0 ? (elapsed / duration) * (samples.length - 1) : 0;
  const step = 8;
  for (let i = 0; i < count; i++) {
    const idx = Math.round(head - (count - 1 - i) * step);
    const raw = idx < 0 ? 0 : (samples[Math.min(samples.length - 1, idx)] ?? 0);
    bars[i] = { v: Math.max(0.07, raw), now: i === count - 1 };
  }
  return bars;
}

export function useWaveform(soundId?: string) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    listeners.add(bump);
    return () => {
      listeners.delete(bump);
    };
  }, []);
  if (!soundId) return null;
  return cache.get(soundId) ?? null;
}

export function resetWaveformForTests() {
  cache.clear();
  inflight.clear();
  failed.clear();
  hydrated.clear();
  listeners.clear();
}
