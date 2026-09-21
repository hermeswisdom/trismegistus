import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AtmanWord } from "@/components/atman-word";
import { CoverMosaic } from "@/components/cover-mosaic";
import { MatrixRain } from "@/components/matrix-rain";
import { authEnabled } from "@/lib/auth/client";
import { readFirstSpinDone } from "@/lib/first-spin";
import { usePlayer } from "@/lib/player-store";
import { loadSoundCloudApi, noteUserGesture } from "@/lib/sc-widget";
import { isRiteKey } from "@/lib/wheel-rite";

function releaseGateFocus() {
  const wall = document.getElementById("wall-main");
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
  wall?.focus({ preventScroll: true });
}

export function EnterGate() {
  const entered = usePlayer((s) => s.entered);
  const enter = usePlayer((s) => s.enter);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [sealed, setSealed] = useState(false);
  const [ready, setReady] = useState(false);
  const [returning, setReturning] = useState(false);
  const latched = useRef(false);
  if (entered) latched.current = true;
  const shut = entered || latched.current || sealed;

  useEffect(() => {
    setReady(true);
    setReturning(readFirstSpinDone());
  }, []);

  useEffect(() => {
    void loadSoundCloudApi().catch(() => {
      /* widget loads later from the dock */
    });
  }, []);

  useLayoutEffect(() => {
    if (!entered) return;
    releaseGateFocus();
    setSealed(true);
  }, [entered]);

  useEffect(() => {
    if (entered || latched.current) return;
    const onKey = (event: KeyboardEvent) => {
      if (!isRiteKey(event.key, event.target)) return;
      event.preventDefault();
      cross();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entered, enter]);

  function cross() {
    buttonRef.current?.blur();
    releaseGateFocus();
    enter();
  }

  return (
    <div
      data-enter-gate=""
      data-gate-ready={ready ? "true" : undefined}
      className={
        "enter-gate fixed top-0 left-0 z-50 flex flex-col overflow-hidden bg-bg transition-[opacity,visibility] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] " +
        (shut ? "pointer-events-none invisible opacity-0" : "visible opacity-100")
      }
      aria-hidden={shut ? true : undefined}
      inert={shut ? true : undefined}
      onPointerDown={noteUserGesture}
    >
      <CoverMosaic className="absolute inset-0 size-full opacity-70" />
      <div className="absolute inset-0 bg-linear-to-b from-bg/30 via-bg/70 to-bg" />
      <div className="hermes-fall hermes-fall-screen">
        <MatrixRain active={!shut} />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="relative z-30 mb-4 text-xs font-medium tracking-[0.42em] text-accent uppercase">
          The listening wall
        </p>
        <AtmanWord as="h1" />
        <p className="relative z-30 mt-3 max-w-sm text-pretty text-sm font-light text-muted sm:text-lead">
          The full SoundCloud catalog. The wall is the record.
        </p>
      </div>

      <div className="relative z-30 mt-auto shrink-0 px-6 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          ref={buttonRef}
          type="button"
          tabIndex={shut ? -1 : 0}
          onPointerDown={noteUserGesture}
          onClick={cross}
          className="inline-flex h-12 min-h-12 w-full touch-manipulation items-center justify-center bg-accent px-7 text-sm font-medium tracking-[0.14em] whitespace-nowrap text-bg uppercase transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96] sm:mx-auto sm:max-w-xs"
        >
          Enter
        </button>
        <p className="relative mt-3 text-center text-xs leading-relaxed text-subtle">
          {returning
            ? "Tap. Your tablet is waiting."
            : "Tap. The wheel turns. A tablet lands."}
        </p>
        {authEnabled ? (
          <Link
            to="/login"
            tabIndex={shut ? -1 : 0}
            className="relative mt-4 flex min-h-11 items-center justify-center text-xs tracking-[0.2em] text-muted uppercase underline-offset-4 hover:text-accent hover:underline"
          >
            Keep a name
          </Link>
        ) : (
          <p className="mt-3 text-center text-xs tracking-[0.18em] text-subtle uppercase">
            Listening needs no name
          </p>
        )}
      </div>
    </div>
  );
}
