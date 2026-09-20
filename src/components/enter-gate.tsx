import { useEffect } from "react";
import { AtmanWord } from "@/components/atman-word";
import { CoverMosaic } from "@/components/cover-mosaic";
import { MatrixRain } from "@/components/matrix-rain";
import { usePlayer } from "@/lib/player-store";
import { loadSoundCloudApi } from "@/lib/sc-widget";

export function EnterGate() {
  const entered = usePlayer((s) => s.entered);
  const enter = usePlayer((s) => s.enter);

  useEffect(() => {
    void loadSoundCloudApi().catch(() => {
      /* widget loads later from the dock */
    });
  }, []);

  return (
    <div
      className={
        "fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg px-6 transition-[opacity,visibility] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] " +
        (entered ? "pointer-events-none invisible opacity-0" : "visible opacity-100")
      }
      aria-hidden={entered}
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
          onClick={() => enter()}
          className="relative z-30 mt-12 inline-flex h-12 w-full min-w-44 items-center justify-center bg-accent px-7 text-sm font-medium tracking-[0.14em] whitespace-nowrap text-bg uppercase transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96] sm:w-auto"
        >
          Enter
        </button>
      </div>
    </div>
  );
}
