"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SPLASH_VIDEO_SRC,
  marcarSplashVisto,
} from "@/lib/splash-web";

interface SplashScreenProps {
  /** Se invoca al terminar el video o al presionar ESC / omitir. */
  onFinalizar: () => void;
}

/**
 * Pantalla de bienvenida a pantalla completa.
 * Reproduce el MP4 sin controles; ESC omite el video.
 */
export function SplashScreen({ onFinalizar }: SplashScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const finalizadoRef = useRef(false);
  const [errorVideo, setErrorVideo] = useState(false);

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

  // Autoplay: muted + reintento tras cargar el archivo
  useEffect(() => {
    const video = videoRef.current;
    if (!video || errorVideo) return;

    video.muted = true;

    const intentarReproducir = () => {
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch(() => {
          /* Esperar otro evento de carga si el navegador aún no está listo */
        });
      }
    };

    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      intentarReproducir();
    } else {
      video.addEventListener("canplay", intentarReproducir, { once: true });
    }

    return () => {
      video.removeEventListener("canplay", intentarReproducir);
    };
  }, [errorVideo]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black"
      role="dialog"
      aria-label="Video de bienvenida Infinity Operaciones"
    >
      {!errorVideo ? (
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
          onError={() => setErrorVideo(true)}
        />
      ) : (
        <div className="text-center text-white px-6 space-y-4">
          <p className="text-lg font-medium">No se pudo cargar el video de bienvenida.</p>
          <p className="text-sm text-white/70">
            Verifique que el archivo esté en <code className="text-white/90">/intro_infinity.mp4</code>
          </p>
          <button
            type="button"
            onClick={finalizar}
            className="px-6 py-2.5 bg-infinity-600 hover:bg-infinity-700 rounded-xl text-sm font-semibold"
          >
            Continuar al login
          </button>
        </div>
      )}

      <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/60 pointer-events-none">
        Presione ESC para omitir
      </p>
    </div>
  );
}
