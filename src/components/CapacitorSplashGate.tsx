"use client";

import { useEffect } from "react";
import { hideCapacitorSplash } from "@/lib/hide-capacitor-splash";

/** En app nativa Capacitor, quita el splash cuando el módulo técnico ya renderizó. */
export function CapacitorSplashGate() {
  useEffect(() => {
    void hideCapacitorSplash();
  }, []);
  return null;
}
