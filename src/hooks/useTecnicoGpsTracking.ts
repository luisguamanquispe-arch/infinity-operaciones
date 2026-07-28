"use client";

import { useEffect, useRef } from "react";
import { enviarUbicacionTecnico, leerGpsActual } from "@/lib/gps-client";

const INTERVALO_MS = 20_000;

/**
 * Publica GPS del técnico mientras la pestaña está visible
 * (panel /tecnico y órdenes). Actualiza el mapa del supervisor.
 */
export function useTecnicoGpsTracking(activo = true) {
  const ultimoEnvio = useRef(0);

  useEffect(() => {
    if (!activo || typeof window === "undefined") return;
    if (!navigator.geolocation) return;

    let cancelled = false;
    let watchId: number | null = null;
    let intervalId: number | null = null;

    async function publicar() {
      if (cancelled) return;
      if (document.visibilityState === "hidden") return;
      const ahora = Date.now();
      if (ahora - ultimoEnvio.current < 12_000) return;

      const coords = await leerGpsActual({ timeoutMs: 8000, maximumAgeMs: 10_000 });
      if (!coords || cancelled) return;

      const ok = await enviarUbicacionTecnico(coords);
      if (ok) ultimoEnvio.current = Date.now();
    }

    void publicar();

    intervalId = window.setInterval(() => {
      void publicar();
    }, INTERVALO_MS);

    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (cancelled || document.visibilityState === "hidden") return;
          const ahora = Date.now();
          if (ahora - ultimoEnvio.current < 12_000) return;
          void enviarUbicacionTecnico({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }).then((ok) => {
            if (ok) ultimoEnvio.current = Date.now();
          });
        },
        () => {
          /* el intervalo de respaldo sigue activo */
        },
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
      );
    } catch {
      /* ignore */
    }

    function onVis() {
      if (document.visibilityState === "visible") void publicar();
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      if (intervalId != null) window.clearInterval(intervalId);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [activo]);
}
