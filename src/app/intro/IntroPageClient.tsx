"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SplashScreen } from "@/components/splash/SplashScreen";
import { SPLASH_DESTINO_WEB } from "@/lib/splash-web";

export default function IntroPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const destino = searchParams.get("next") || SPLASH_DESTINO_WEB;

  return (
    <SplashScreen
      onFinalizar={() => {
        router.replace(destino.startsWith("/") ? destino : SPLASH_DESTINO_WEB);
      }}
    />
  );
}
