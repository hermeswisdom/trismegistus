export type SCWidget = {
  bind: (event: string, listener: (...args: unknown[]) => void) => void;
  unbind: (event: string) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  load: (url: string, options?: { auto_play?: boolean }) => void;
  seekTo: (ms: number) => void;
  getPosition: (cb: (ms: number) => void) => void;
  getDuration: (cb: (ms: number) => void) => void;
  getVolume: (cb: (vol: number) => void) => void;
  setVolume: (vol: number) => void;
  getCurrentSound: (
    cb: (sound: { id?: number; waveform_url?: string } | null) => void,
  ) => void;
};

type SCApi = {
  Widget: {
    (el: HTMLIFrameElement): SCWidget;
    Events: {
      READY: string;
      PLAY: string;
      PAUSE: string;
      FINISH: string;
      PLAY_PROGRESS: string;
    };
  };
};

declare global {
  interface Window {
    SC?: SCApi;
  }
}

const SCRIPT = "https://w.soundcloud.com/player/api.js";
let loading: Promise<SCApi> | null = null;

export function loadSoundCloudApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.SC) return Promise.resolve(window.SC);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.SC) resolve(window.SC);
        else reject(new Error("SC missing"));
      });
      existing.addEventListener("error", () => reject(new Error("SC script failed")));
      if (window.SC) resolve(window.SC);
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => {
      if (window.SC) resolve(window.SC);
      else reject(new Error("SC missing"));
    };
    script.onerror = () => reject(new Error("SC script failed"));
    document.head.appendChild(script);
  });
  return loading;
}

let live: SCWidget | null = null;
let liveSoundId: string | null = null;

export function setLiveWidget(widget: SCWidget | null, soundId?: string | null) {
  live = widget;
  if (soundId !== undefined) liveSoundId = soundId;
}

export function getLiveWidget() {
  return live;
}

export function getLiveSoundId() {
  return liveSoundId;
}

export function setLiveSoundId(id: string) {
  liveSoundId = id;
}
