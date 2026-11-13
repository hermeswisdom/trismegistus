import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  SITE_BG_MP4,
  SITE_BG_NARROW_MAX_PX,
  SITE_BG_POSTER,
  SITE_BG_WEBM,
  afterLoadIdle,
  connectionSaveData,
  isHermesPath,
  shouldMountSiteBackgroundVideo,
} from "@/lib/site-backdrop";
import { cn } from "@/lib/utils";

/**
 * Fixed viewport layer behind the app. Overlay is server-rendered (no extra
 * bytes on LCP). Poster / <video> sources mount only after load+idle.
 */
export function SiteBackdrop() {
  const posterOnlyRoute = useRouterState({
    select: (s) => isHermesPath(s.location.pathname),
  });
  const [ready, setReady] = useState(false);
  const [allowVideo, setAllowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    return afterLoadIdle(() => {
      const narrow = window.matchMedia(
        `(max-width: ${SITE_BG_NARROW_MAX_PX}px)`,
      ).matches;
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const saveData = connectionSaveData(
        navigator as Navigator & {
          connection?: { saveData?: boolean };
          mozConnection?: { saveData?: boolean };
          webkitConnection?: { saveData?: boolean };
        },
      );
      setAllowVideo(
        shouldMountSiteBackgroundVideo({
          narrow,
          reducedMotion,
          saveData,
          posterOnlyRoute: false,
        }),
      );
      setReady(true);
    });
  }, []);

  const useVideo = ready && allowVideo && !posterOnlyRoute;
  const usePoster = ready && !useVideo;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !useVideo) return;
    video.muted = true;
    video.playsInline = true;
    const play = () => {
      void video.play().catch(() => {
        /* autoplay can still be refused; poster remains */
      });
    };
    const onVisibility = () => {
      if (document.hidden) video.pause();
      else play();
    };
    play();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      video.pause();
    };
  }, [useVideo]);

  return (
    <div className="site-backdrop" aria-hidden="true">
      {useVideo ? (
        <video
          ref={videoRef}
          className="site-backdrop-media"
          muted
          autoPlay
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          tabIndex={-1}
          poster={SITE_BG_POSTER}
        >
          <source src={SITE_BG_WEBM} type="video/webm" />
          <source src={SITE_BG_MP4} type="video/mp4" />
        </video>
      ) : usePoster ? (
        <img
          className="site-backdrop-media"
          src={SITE_BG_POSTER}
          alt=""
          decoding="async"
        />
      ) : null}
      <div
        className={cn(
          "site-backdrop-overlay",
          posterOnlyRoute && "site-backdrop-overlay-strong",
        )}
      />
    </div>
  );
}
