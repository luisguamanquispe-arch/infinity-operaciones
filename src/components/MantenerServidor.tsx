"use client";

import { useEffect } from "react";

const CADA_MS = 8 * 60 * 1000;

/** Mientras el programa o la app están abiertos, evita que Render se duerma y muestre su pantalla negra. */
export function MantenerServidor() {
  useEffect(() => {
    const ping = () => {
      fetch("/api/health", { cache: "no-store" }).catch(() => {});
    };
    ping();
    const id = window.setInterval(ping, CADA_MS);
    const alVolver = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);
  return null;
}
