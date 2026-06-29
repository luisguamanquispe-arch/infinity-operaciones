"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SplashScreen } from "./SplashScreen";
import {
  SPLASH_DESTINO_WEB,
  debeMostrarSplashWeb,
} from "@/lib/splash-web";

type EstadoEntrada = "cargando" | "splash" | "listo";

/**
 * Punto de entrada web (/).
 * Muestra el splash una sola vez; en app móvil/PWA técnico va directo al login.
 */
export function HomeEntry() {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoEntrada>("cargando");

  useEffect(() => {
    if (debeMostrarSplashWeb()) {
      setEstado("splash");
      return;
    }
    setEstado("listo");
    router.replace(SPLASH_DESTINO_WEB);
  }, [router]);

  if (estado === "cargando") {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-infinity-800">
        <Loader2 className="w-8 h-8 animate-spin text-white" aria-hidden />
      </div>
    );
  }

  if (estado === "splash") {
    return (
      <SplashScreen
        onFinalizar={() => router.replace(SPLASH_DESTINO_WEB)}
      />
    );
  }

  return null;
}
