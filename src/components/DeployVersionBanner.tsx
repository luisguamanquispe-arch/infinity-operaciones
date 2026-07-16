"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

const VERSION_ESPERADA = "infinity-operaciones";

/** Avisa si Render no desplegó la imagen Docker reciente. */
export function DeployVersionBanner() {
  const [stale, setStale] = useState(false);
  const [gitSha, setGitSha] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setGitSha(d.gitSha ?? null);
        setStale(d.service !== VERSION_ESPERADA);
      })
      .catch(() => setStale(true));
  }, []);

  if (!stale) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-300 px-4 py-3 text-sm text-amber-950">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-start gap-2 flex-1">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Versión desactualizada en el servidor</p>
            <p className="text-amber-900 mt-0.5">
              Faltan funciones recientes (ticket infraestructura, materiales, cronómetro automático).
              En Render: servicio Docker con imagen{" "}
              <code className="text-xs bg-amber-100 px-1 rounded">
                ghcr.io/luisguamanquispe-arch/infinity-operaciones:latest
              </code>
              , GHCR público, Manual Deploy con Clear cache, y secret{" "}
              <code className="text-xs bg-amber-100 px-1 rounded">RENDER_DEPLOY_HOOK</code> en GitHub.
            </p>
            {gitSha && (
              <p className="text-xs text-amber-800 mt-1">
                Versión en servidor: {gitSha === "unknown" ? "sin GIT_SHA (build viejo)" : gitSha}
              </p>
            )}
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

/** Accesos rápidos del panel gerencial (admin). */
export function GerenciaQuickNav({ totalTecnicos }: { totalTecnicos?: number }) {
  return (
    <nav
      aria-label="Menú gerencial"
      className="flex flex-wrap gap-2"
    >
      <Link
        href="/gerencia/tecnicos/nuevo"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-infinity-600 hover:bg-infinity-700 text-white text-sm font-medium"
      >
        + Nuevo técnico
      </Link>
      <Link
        href="/gerencia/tecnicos"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-infinity-600 text-infinity-700 text-sm font-medium hover:bg-infinity-50"
      >
        Técnicos{totalTecnicos != null ? ` (${totalTecnicos})` : ""}
      </Link>
      <Link
        href="/gerencia/soportes"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-red-400 bg-red-50 text-red-800 text-sm font-semibold hover:bg-red-100"
      >
        Eliminar soportes
      </Link>
      <Link
        href="/gerencia/usuarios"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-purple-600 text-purple-700 text-sm font-medium hover:bg-purple-50"
      >
        Usuarios y claves
      </Link>
      <Link
        href="/reportes"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-600 text-emerald-700 text-sm font-medium hover:bg-emerald-50"
      >
        Reportes
      </Link>
      <Link
        href="/help-desk"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-teal-600 text-teal-700 text-sm font-medium hover:bg-teal-50"
      >
        Help Desk remoto
      </Link>
      <Link
        href="/supervisor/clientes"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sky-600 text-sky-700 text-sm font-medium hover:bg-sky-50"
      >
        Clientes CRM
      </Link>
    </nav>
  );
}

/** Accesos rápidos del supervisor (infraestructura, calendario, reportes). */
export function SupervisorQuickNav() {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/supervisor/tickets/nuevo-infraestructura"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-800 text-white text-sm font-medium"
      >
        + Ticket infraestructura
      </Link>
      <Link
        href="/supervisor/tickets/nuevo"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-infinity-600 hover:bg-infinity-700 text-white text-sm font-medium"
      >
        + Ticket soporte
      </Link>
      <Link
        href="/supervisor/clientes"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-600 text-sky-700 text-sm font-medium hover:bg-sky-50"
      >
        Clientes CRM
      </Link>
      <Link
        href="/supervisor/calendario"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-infinity-600 text-infinity-700 text-sm font-medium hover:bg-infinity-50"
      >
        Calendario
      </Link>
      <Link
        href="/supervisor/novedades"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-amber-500 bg-amber-50 text-amber-900 text-sm font-semibold hover:bg-amber-100"
      >
        Novedades soporte
      </Link>
      <Link
        href="/help-desk"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-600 text-teal-700 text-sm font-medium hover:bg-teal-50"
      >
        Help Desk remoto
      </Link>
    </div>
  );
}
