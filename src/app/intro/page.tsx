import { Suspense } from "react";
import IntroPageClient from "./IntroPageClient";

export default function IntroPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-black flex items-center justify-center text-white text-sm">
          Cargando…
        </div>
      }
    >
      <IntroPageClient />
    </Suspense>
  );
}
