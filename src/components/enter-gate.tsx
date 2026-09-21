import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { AtmanWord } from "@/components/atman-word";
import { CoverMosaic } from "@/components/cover-mosaic";
import { MatrixRain } from "@/components/matrix-rain";
import { authEnabled } from "@/lib/auth/client";
import { usePlayer } from "@/lib/player-store";
import { loadSoundCloudApi, primePlayback } from "@/lib/sc-widget";
import { isRiteKey } from "@/lib/wheel-rite";

export function EnterGate() {
  const entered = usePlayer((s) => s.entered);
  const enter = usePlayer((s) => s.enter);

  useEffect(() => {
    void loadSoundCloudApi().catch(() => {
      /* widget loads later from the dock */
    });
  }, []);

  useEffect(() => {
    if (entered) return;
    const onKey = (event: KeyboardEvent) => {
      if (!isRiteKey(event.key, event.target)) return;
      event.preventDefault();
      enter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entered, enter]);

  return (
    <div
      className={
        "fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-bg px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] transition-[opacity,visibility] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] " +
        (entered ? "pointer-events-none invisible opacity-0" : "visible opacity-100")
      }
      aria-hidden={entered}
      onPointerDown={primePlayback}
    >
      <CoverMosaic className="absolute inset-0 size-full opacity-70" />
      <div className="absolute inset-0 bg-linear-to-b from-bg/30 via-bg/70 to-bg" />
      <div className="hermes-fall hermes-fall-screen">
        <MatrixRain active={!entered} />
      </div>
      <div className="relative flex w-full max-w-5xl flex-col items-center text-center">
        <p className="relative z-30 mb-6 text-xs font-medium tracking-[0.42em] text-accent uppercase">
          Esoteric music
        </p>
        <AtmanWord as="h1" />
        <p className="relative z-30 mt-3 max-w-sm text-lead font-light text-muted">
          Esoteric Vibrations. The full SoundCloud catalog. The wall is the record.
        </p>
        <button
          type="button"
          onPointerDown={primePlayback}
          onClick={() => enter()}
          className="relative z-30 mt-12 inline-flex h-12 min-h-12 w-full min-w-44 touch-manipulation items-center justify-center bg-accent px-7 text-sm font-medium tracking-[0.14em] whitespace-nowrap text-bg uppercase transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96] sm:w-auto"
        >
          Enter
        </button>
        <p className="relative z-30 mt-4 max-w-xs text-xs leading-relaxed text-subtle">
          Tap or press Enter. The wheel turns. A tablet lands.
        </p>
        {authEnabled ? (
          <Link
            to="/login"
            className="relative z-30 mt-8 text-xs tracking-[0.2em] text-muted uppercase underline-offset-4 hover:text-accent hover:underline"
          >
            Keep a name
          </Link>
        ) : null}
      </div>
    </div>
  );
}
