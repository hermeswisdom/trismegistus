/**
 * TEMPORARY (?debug=audio): which engine is playing and why audio last
 * paused, for phone screenshots while testing lock-screen playback.
 * Remove with src/lib/audio-debug.ts once Atman has confirmed the fix.
 */
import { useEffect, useState } from "react";
import {
  clearDebugLog,
  debugEvent,
  getDebugLog,
  getLastPause,
  pauseLabel,
  isAudioDebug,
  subscribeDebug,
} from "@/lib/audio-debug";
import { getNativeElement, nativePhase } from "@/lib/native-audio";
import { usePlayer } from "@/lib/player-store";
import { gestureAudioContextState, getAttemptPhase } from "@/lib/sc-widget";

function hhmmss(at: number) {
  const d = new Date(at);
  return d.toTimeString().slice(0, 8);
}

function sessionInfo() {
  const s = (navigator as Navigator & { audioSession?: { type?: string; state?: string } }).audioSession;
  return s ? `${s.type ?? "?"}/${s.state ?? "?"}` : "unsupported";
}

function displayMode() {
  try {
    if ((navigator as Navigator & { standalone?: boolean }).standalone) return "home-screen app";
    if (window.matchMedia("(display-mode: standalone)").matches) return "standalone";
  } catch {
    /* ignore */
  }
  return "browser tab";
}

function shortUa() {
  const ua = navigator.userAgent;
  const ios = /OS (\d+[_\d]*) like Mac OS X/.exec(ua)?.[1]?.replace(/_/g, ".");
  const android = /Android ([\d.]+)/.exec(ua)?.[1];
  const app = /CriOS|FxiOS|EdgiOS|GSA|Instagram|FBAN|FBAV|Line|Twitter|Grok|wv\)/.exec(ua)?.[0];
  const os = ios ? `iOS ${ios}` : android ? `Android ${android}` : navigator.platform;
  const browser = app ?? (/Version\/[\d.]+.*Safari/.test(ua) ? "Safari" : /Chrome\/[\d]+/.exec(ua)?.[0] ?? "?");
  return `${os} · ${browser}`;
}

export function AudioDebugPanel() {
  const [on, setOn] = useState(false);
  const [, setTick] = useState(0);
  const [open, setOpen] = useState(true);
  const player = {
    backend: usePlayer((s) => s.backend),
    playing: usePlayer((s) => s.playing),
    pending: usePlayer((s) => s.playPending),
    error: usePlayer((s) => s.playError),
    current: usePlayer((s) => s.currentId),
  };

  useEffect(() => {
    if (!isAudioDebug()) return;
    setOn(true);
    const nav = performance.getEntriesByType?.("navigation")?.[0] as PerformanceNavigationTiming | undefined;
    debugEvent("page", `load (${nav?.type ?? "?"}) ${displayMode()}`);
    const bump = () => setTick((n) => n + 1);
    const unsub = subscribeDebug(bump);
    const timer = window.setInterval(bump, 1000);
    const docEvents = ["visibilitychange", "pagehide", "pageshow", "freeze", "resume"];
    const onDoc = (e: Event) => debugEvent(`page:${e.type}`, document.visibilityState);
    const onWin = (e: Event) => debugEvent(`page:${e.type}`, document.visibilityState);
    docEvents.forEach((t) => document.addEventListener(t, onDoc));
    window.addEventListener("pagehide", onWin);
    window.addEventListener("pageshow", onWin);
    window.addEventListener("blur", onWin);
    window.addEventListener("focus", onWin);
    const session = (navigator as Navigator & { audioSession?: EventTarget & { state?: string } }).audioSession;
    const onSession = () =>
      debugEvent("audioSession", `statechange (type=${(session as { type?: string } | undefined)?.type ?? "?"}, state=${session?.state ?? "n/a"})`);
    session?.addEventListener?.("statechange", onSession);
    return () => {
      unsub();
      window.clearInterval(timer);
      docEvents.forEach((t) => document.removeEventListener(t, onDoc));
      window.removeEventListener("pagehide", onWin);
      window.removeEventListener("pageshow", onWin);
      window.removeEventListener("blur", onWin);
      window.removeEventListener("focus", onWin);
      session?.removeEventListener?.("statechange", onSession);
    };
  }, []);

  if (!on) return null;
  const a = getNativeElement();
  const last = getLastPause();
  const log = getDebugLog().slice(-30).reverse();
  const iframes = document.querySelectorAll('iframe[title^="SoundCloud"]').length;
  const via = new URLSearchParams(window.location.search).get("stream") === "direct" ? "direct (cross-origin)" : "same-origin";
  const engine = player.backend === "native" ? "NATIVE <audio>" : "SOUNDCLOUD iframe";
  const state = player.playing ? "playing" : player.pending ? "pending" : player.error ? "blocked (Tap to play)" : "paused";
  const lines = [
    `engine: ${engine} · ${state} · ${player.current}`,
    a
      ? `audio: ${a.paused ? "PAUSED" : "running"} t=${a.currentTime.toFixed(1)}/${Number.isFinite(a.duration) ? a.duration.toFixed(0) : "?"} muted=${a.muted} rs=${a.readyState} ns=${a.networkState} inDOM=${a.isConnected} playsinline=${a.hasAttribute("playsinline")} phase=${nativePhase()}`
      : "audio: (not created yet)",
    `sc widget: ${getAttemptPhase()} · SC iframe: ${iframes ? "LOADED" : "none"} · AudioContext: ${gestureAudioContextState()} · audioSession: ${sessionInfo()}`,
    `stream: ${via}${a?.currentSrc ? ` · ${a.currentSrc.replace(/^https?:\/\/([^/]+).*/, "$1")}` : ""}`,
    `page: ${document.visibilityState} · ${displayMode()} · ${shortUa()}`,
    last
      ? `LAST PAUSE ${hhmmss(last.at)}: ${pauseLabel(last)} — ${last.reason} [page ${last.visibility}, t=${last.time.toFixed(1)}${last.media ? ` ${last.media}` : ""}]${last.stack ? ` @ ${last.stack}` : ""}`
      : "LAST PAUSE: none",
  ];
  const text = [...lines, "", ...log.map((e) => `${hhmmss(e.at)} ${e.kind} ${e.detail ?? ""}`)].join("\n");

  return (
    <div
      data-audio-debug=""
      data-engine={player.backend}
      style={{
        position: "fixed",
        top: 4,
        left: 4,
        zIndex: 2147483000,
        maxWidth: "min(96vw, 560px)",
        maxHeight: open ? "62vh" : undefined,
        overflow: "auto",
        background: "rgba(0,0,0,0.88)",
        color: "#b8f5b0",
        border: "1px solid #3a5",
        font: "10px/1.35 ui-monospace, Menlo, monospace",
        padding: "4px 6px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 2 }}>
        <strong style={{ color: "#fff" }}>audio debug</strong>
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ textDecoration: "underline" }}>
          {open ? "hide" : "show"}
        </button>
        <button type="button" onClick={() => void navigator.clipboard?.writeText(text)} style={{ textDecoration: "underline" }}>
          copy
        </button>
        <button type="button" onClick={() => clearDebugLog()} style={{ textDecoration: "underline" }}>
          clear
        </button>
      </div>
      <div data-audio-debug-engine="">{lines[0]}</div>
      {open ? (
        <>
          {lines.slice(1).map((l) => (
            <div key={l.slice(0, 12)} data-audio-debug-pause={l.startsWith("LAST PAUSE") ? "" : undefined}>
              {l}
            </div>
          ))}
          <div style={{ marginTop: 4, color: "#9ab" }}>
            {log.map((e, i) => (
              <div key={`${e.at}-${i}`}>
                {hhmmss(e.at)} {e.kind} {e.detail ?? ""}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
