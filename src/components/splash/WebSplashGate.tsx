"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SplashScreen } from "./SplashScreen";
import { debeMostrarSplashWeb } from "@/lib/splash-web";

interface WebSplashGateProps {
  children: React.ReactNode;
}

/**
 * Muestra el video de bienvenida una sola vez antes del contenido web.
 * No envuelve la app móvil ni /login?app=tecnico.
 */
export function WebSplashGate({ children }: WebSplashGateProps) {
  const [mostrarSplash, setMostrarSplash] = useState<boolean | null>(null);

  useEffect(() => {
    setMostrarSplash(debeMostrarSplashWeb());
  }, []);

  if (mostrarSplash === null) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-infinity-800">
        <Loader2 className="w-8 h-8 animate-spin text-white" aria-hidden />
      </div>
    );
  }

  if (mostrarSplash) {
    return <SplashScreen onFinalizar={() => setMostrarSplash(false)} />;
  }

  return <>{children}</>;
}
