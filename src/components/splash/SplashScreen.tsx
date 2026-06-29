"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  SPLASH_VIDEO_SRC,
  marcarSplashVisto,
} from "@/lib/splash-web";

interface SplashScreenProps {
  onFinalizar: () => void;
}

type EstadoVideo = "cargando" | "reproduciendo" | "error";

/**
 * Pantalla de bienvenida a pantalla completa.
 * Sin controles visibles; ESC omite el video.
 */
export function SplashScreen({ onFinalizar }: SplashScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const finalizadoRef = useRef(false);
  const [estado, setEstado] = useState<EstadoVideo>("cargando");
  const [detalleError, setDetalleError] = useState("");

  const finalizar = useCallback(() => {
    if (finalizadoRef.current) return;
    finalizadoRef.current = true;
    marcarSplashVisto();
    onFinalizar();
  }, [onFinalizar]);

  const intentarReproducir = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    try {
      await video.play();
      setEstado("reproduciendo");
    } catch {
      setEstado("error");
      setDetalleError("El navegador bloqueó la reproducción automática.");
    }
  }, []);

  // Verificar que el archivo exista antes de montar el reproductor
  useEffect(() => {
    let activo = true;

    async function verificarYPreparar() {
      try {
        const res = await fetch(SPLASH_VIDEO_SRC, { method: "HEAD", cache: "no-store" });
        if (!activo) return;
        if (!res.ok) {
          setEstado("error");
          setDetalleError(`El video no está en el servidor (HTTP ${res.status}).`);
          return;
        }
        const tipo = res.headers.get("content-type") || "";
        if (tipo && !tipo.includes("video") && !tipo.includes("octet-stream")) {
          setEstado("error");
          setDetalleError(`Tipo de archivo inesperado: ${tipo}`);
        }
      } catch {
        if (!activo) return;
        setEstado("error");
        setDetalleError("No se pudo conectar con el servidor del video.");
      }
    }

    void verificarYPreparar();
    return () => {
      activo = false;
    };
  }, []);

  // ESC para omitir
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

  const onVideoListo = useCallback(() => {
    void intentarReproducir();
  }, [intentarReproducir]);

  const onVideoError = useCallback(() => {
    setEstado("error");
    setDetalleError("No se pudo decodificar el archivo MP4 en este navegador.");
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black min-h-dvh">
      {estado !== "error" && (
        <>
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
            onLoadedData={onVideoListo}
            onCanPlay={onVideoListo}
            onPlaying={() => setEstado("reproduciendo")}
            onEnded={finalizar}
            onError={onVideoError}
          />
          {estado === "cargando" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
              <Loader2 className="w-10 h-10 animate-spin text-white" />
              <p className="text-sm text-white/70">Cargando bienvenida…</p>
            </div>
          )}
        </>
      )}

      {estado === "error" && (
        <div className="text-center text-white px-6 space-y-4 max-w-md">
          <p className="text-lg font-semibold">No se pudo reproducir el video</p>
          {detalleError && <p className="text-sm text-white/70">{detalleError}</p>}
          <p className="text-xs text-white/50 break-all">{SPLASH_VIDEO_SRC}</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={() => {
                setEstado("cargando");
                setDetalleError("");
                const v = videoRef.current;
                if (v) {
                  v.load();
                  void intentarReproducir();
                }
              }}
              className="px-5 py-2.5 border border-white/30 rounded-xl text-sm font-medium hover:bg-white/10"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={finalizar}
              className="px-5 py-2.5 bg-infinity-600 hover:bg-infinity-700 rounded-xl text-sm font-semibold"
            >
              Continuar al login
            </button>
          </div>
        </div>
      )}

      <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/50 pointer-events-none">
        Presione ESC para omitir
      </p>
    </div>
  );
}
