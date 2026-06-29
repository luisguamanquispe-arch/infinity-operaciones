"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SPLASH_DESTINO_WEB } from "@/lib/splash-web";

/**
 * Punto de entrada (/): redirige al login donde se muestra el splash web.
 */
export function HomeEntry() {
  const router = useRouter();

  useEffect(() => {
    router.replace(SPLASH_DESTINO_WEB);
  }, [router]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-infinity-800">
      <Loader2 className="w-8 h-8 animate-spin text-white" aria-hidden />
    </div>
  );
}
