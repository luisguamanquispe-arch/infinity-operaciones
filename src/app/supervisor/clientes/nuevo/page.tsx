import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import NuevoClientePageClient from "./NuevoClientePageClient";

export default function NuevoClientePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
        </div>
      }
    >
      <NuevoClientePageClient />
    </Suspense>
  );
}
