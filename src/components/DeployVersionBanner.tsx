"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/** Reexport: menús viven en ModuleQuickNav (matriz src/lib/modulos-acceso). */
export {
  GerenciaQuickNav,
  SupervisorQuickNav,
} from "@/components/ModuleQuickNav";

const VERSION_ESPERADA = "infinity-operaciones";

type HealthPayload = {
  gitSha?: string;
  gitShaShort?: string | null;
  stale?: boolean;
  latestRecommended?: string;
  service?: string;
};

/** Avisa solo si el servidor reporta explícitamente que está obsoleto. */
export function DeployVersionBanner() {
  const [health, setHealth] = useState<HealthPayload | null>(null);

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: HealthPayload) => setHealth(d))
      .catch(() => setHealth(null));
  }, []);

  // Solo mostrar si /api/health dice stale: true (decisión del servidor, no del navegador).
  if (!health || health.stale !== true || health.service !== VERSION_ESPERADA) {
    return null;
  }

  const shaLabel =
    health.gitShaShort ||
    (health.gitSha && health.gitSha !== "unknown" ? health.gitSha.slice(0, 7) : "desconocida");

  return (
    <div className="bg-amber-50 border-b border-amber-300 px-4 py-3 text-sm text-amber-950">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-start gap-2 flex-1">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Versión desactualizada en el servidor</p>
            <p className="text-amber-900 mt-0.5">
              Faltan funciones recientes. En Render: Manual Deploy → Clear build cache.
              {health.latestRecommended && (
                <>
                  {" "}
                  Última en GitHub:{" "}
                  <code className="text-xs bg-amber-100 px-1 rounded">{health.latestRecommended}</code>.
                </>
              )}{" "}
              Configure <code className="text-xs bg-amber-100 px-1 rounded">RENDER_DEPLOY_HOOK</code> en GitHub.
            </p>
            <p className="text-xs text-amber-800 mt-1">Versión en servidor: {shaLabel}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 font-medium shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar
        </button>
      </div>
    </div>
  );
}
