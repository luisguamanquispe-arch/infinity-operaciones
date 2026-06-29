"use client";

import { LoginForm } from "./LoginForm";

interface LoginShellProps {
  esAppTecnico: boolean;
}

/** Login web: el splash se muestra vía /intro (middleware). */
export function LoginShell({ esAppTecnico }: LoginShellProps) {
  return <LoginForm esAppTecnico={esAppTecnico} />;
}
