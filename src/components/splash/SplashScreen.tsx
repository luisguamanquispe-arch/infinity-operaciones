"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  SPLASH_VIDEO_SRC,
  marcarSplashVisto,
} from "@/lib/splash-web";

interface SplashScreenProps {
  /** Se invoca al terminar el video o al presionar ESC. */
  onFinalizar: () => void;
}

/**
 * Pantalla de bienvenida a pantalla completa.
 * Reproduce el MP4 sin controles; ESC omite el video.
 */
export function SplashScreen({ onFinalizar }: SplashScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const finalizadoRef = useRef(false);

  const finalizar = useCallback(() => {
    if (finalizadoRef.current) return;
    finalizadoRef.current = true;
    marcarSplashVisto();
    onFinalizar();
  }, [onFinalizar]);

  // ESC: saltar video e ir al menú principal
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        finalizar();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finalizar]);

  // Autoplay: los navegadores exigen muted para reproducir sin interacción
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch(() => {
        /* Si falla el autoplay, permitir entrar igual */
        finalizar();
      });
    }
  }, [finalizar]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      role="dialog"
      aria-label="Video de bienvenida Infinity Operaciones"
    >
      <video
        ref={videoRef}
        src={SPLASH_VIDEO_SRC}
        className="h-full w-full object-contain"
        autoPlay
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        controls={false}
        controlsList="nodownload noplaybackrate noremoteplayback"
        onEnded={finalizar}
        onError={finalizar}
      />

      <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/60 pointer-events-none">
        Presione ESC para omitir
      </p>
    </div>
  );
}
