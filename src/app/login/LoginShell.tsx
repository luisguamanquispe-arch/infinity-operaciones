"use client";

import { LoginForm } from "./LoginForm";
import { WebSplashGate } from "@/components/splash/WebSplashGate";

interface LoginShellProps {
  esAppTecnico: boolean;
}

/**
 * Envuelve el login web con el splash de bienvenida (una sola vez).
 * La app técnico (?app=tecnico / Capacitor) no muestra el video.
 */
export function LoginShell({ esAppTecnico }: LoginShellProps) {
  if (esAppTecnico) {
    return <LoginForm esAppTecnico />;
  }

  return (
    <WebSplashGate>
      <LoginForm esAppTecnico={false} />
    </WebSplashGate>
  );
}
