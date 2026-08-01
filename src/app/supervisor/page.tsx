"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, AlertTriangle, CheckCircle, Clock, Users, Plus, FileText, CalendarDays, Contact } from "lucide-react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { StatCard } from "@/components/StatCard";
import { TicketSemaforo } from "@/components/TicketSemaforo";
import { GitShaBadge } from "@/components/GitShaBadge";
import { ESTADO_TECNICO_LABELS, PRIORIDAD_LABELS } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json-client";

const MapInner = dynamic(() => import("@/components/MapInner"), {
  ssr: false,
  loading: () => <div className="h-64 bg-slate-100 animate-pulse rounded-xl" />,
});

interface DashboardData {
  kpis: {
    abiertos: number;
    cerrados: number;
    vencidos: number;
    tiempoPromedioMin: number;
    primeraVisitaPct: number;
  };
  tecnicos: {
    id: string;
    nombre: string;
    estado: string;
    lat: number | null;
    lng: number | null;
  }[];
  tickets: {
    id: string;
    codigo: string;
    prioridad: string;
    estado: string;
    cliente: { nombre: string; sector: string };
    tecnicosLabel: string;
    novedadPendiente?: boolean;
    novedadLabel?: string | null;
  }[];
}

export default function SupervisorDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gpsLive, setGpsLive] = useState<
    Record<
      string,
      {
        lat: number | null;
        lng: number | null;
        ageSec: number | null;
        stale: boolean;
        enVivo: boolean;
        estado: string;
        nombre: string;
      }
    >
  >({});

  useEffect(() => {
    async function load() {
      const { data: json, error: err } = await fetchJson<DashboardData>(
        "/api/supervisor/dashboard"
      );
      if (err || !json?.kpis) {
        setError(err || "No se pudo cargar el panel");
        setData(null);
      } else {
        setData(json);
        setError("");
      }
      setLoading(false);
    }
    load();

    const interval = setInterval(async () => {
      const { data: json } = await fetchJson<DashboardData>("/api/supervisor/dashboard");
      if (json?.kpis) setData(json);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadGps() {
      const { data: json } = await fetchJson<{
        tecnicos: {
          id: string;
          nombre: string;
          estado: string;
          lat: number | null;
          lng: number | null;
          ageSec: number | null;
          stale: boolean;
          enVivo: boolean;
        }[];
      }>("/api/supervisor/ubicaciones");
      if (!json?.tecnicos) return;
      const map: typeof gpsLive = {};
      for (const t of json.tecnicos) {
        map[t.id] = {
          lat: t.lat,
          lng: t.lng,
          ageSec: t.ageSec,
          stale: t.stale,
          enVivo: t.enVivo,
          estado: t.estado,
          nombre: t.nombre,
        };
      }
      setGpsLive(map);
    }
    void loadGps();
    const id = setInterval(() => void loadGps(), 8000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-4 gap-3">
        <p className="text-red-700 text-sm text-center">{error || "Error al cargar"}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-infinity-600 text-sm font-medium hover:underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const tecnicosMapa = data.tecnicos.map((t) => {
    const live = gpsLive[t.id];
    return {
      ...t,
      lat: live?.lat ?? t.lat,
      lng: live?.lng ?? t.lng,
      ageSec: live?.ageSec ?? null,
      stale: live?.stale ?? true,
      enVivo: live?.enVivo ?? false,
      estado: live?.estado ?? t.estado,
    };
  });

  const mapPoints = tecnicosMapa
    .filter((t) => t.lat != null && t.lng != null)
    .map((t) => ({
      id: t.id,
      lat: t.lat!,
      lng: t.lng!,
      stale: t.stale,
      label: `${t.nombre} (${ESTADO_TECNICO_LABELS[t.estado] || t.estado})${
        t.enVivo
          ? ` · en vivo${t.ageSec != null ? ` · ${t.ageSec}s` : ""}`
          : t.ageSec != null
            ? ` · hace ${t.ageSec}s`
            : " · sin señal reciente"
      }`,
      type: "tecnico" as const,
    }));

  const enVivoCount = tecnicosMapa.filter((t) => t.enVivo).length;

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Panel Supervisor" subtitle="Tickets activos · GPS en vivo · reportes" />

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            href="/supervisor/tickets/nuevo"
            className="flex items-center justify-center gap-2 py-3 bg-infinity-600 hover:bg-infinity-700 text-white font-semibold rounded-xl transition"
          >
            <Plus className="w-5 h-5" />
            Nuevo ticket de soporte
          </Link>
          <Link
            href="/infraestructura"
            className="flex items-center justify-center gap-2 py-3 bg-cyan-700 hover:bg-cyan-800 text-white font-semibold rounded-xl transition"
          >
            <Plus className="w-5 h-5" />
            Infraestructura de Red
          </Link>
          <Link
            href="/help-desk"
            className="flex items-center justify-center gap-2 py-3 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl transition"
          >
            <Plus className="w-5 h-5" />
            Soporte Remoto
          </Link>
          <Link
            href="/supervisor/tickets/nuevo-infraestructura"
            className="flex items-center justify-center gap-2 py-3 bg-violet-700 hover:bg-violet-800 text-white font-semibold rounded-xl transition"
          >
            <Plus className="w-5 h-5" />
            Ticket infraestructura
          </Link>
          <Link
            href="/supervisor/calendario"
            className="flex items-center justify-center gap-2 py-3 bg-white border-2 border-infinity-600 text-infinity-600 font-semibold rounded-xl hover:bg-infinity-50 transition"
          >
            <CalendarDays className="w-5 h-5" />
            Calendario de soporte
          </Link>
          <Link
            href="/reportes"
            className="flex items-center justify-center gap-2 py-3 border border-infinity-600 text-infinity-600 font-semibold rounded-xl hover:bg-infinity-50 transition"
          >
            <FileText className="w-5 h-5" />
            Reportes finalizados
          </Link>
          <Link
            href="/supervisor/asignaciones"
            className="flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition"
          >
            <Users className="w-5 h-5" />
            Destinar tickets a técnicos
          </Link>
          <Link
            href="/supervisor/clientes"
            className="flex items-center justify-center gap-2 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl transition sm:col-span-2 lg:col-span-3"
          >
            <Contact className="w-5 h-5" />
            Clientes CRM
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Abiertos" value={data.kpis.abiertos} color="blue" />
          <StatCard label="Cerrados hoy" value={data.kpis.cerrados} color="green" />
          <StatCard label="Vencidos" value={data.kpis.vencidos} color="red" />
          <StatCard
            label="Tiempo prom."
            value={`${data.kpis.tiempoPromedioMin}m`}
            icon={Clock}
            color="slate"
          />
          <StatCard
            label="1ra visita"
            value={`${data.kpis.primeraVisitaPct}%`}
            icon={CheckCircle}
            color="green"
          />
        </div>

        {/* Mapa técnicos */}
        <section>
          <h2 className="font-semibold mb-1 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Técnicos en campo (GPS)
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Actualización cada 8 s · {enVivoCount} en vivo
            {mapPoints.length === 0
              ? " · Aún sin señal: el técnico debe abrir la app con GPS permitido"
              : ""}
          </p>

          {mapPoints.length > 0 ? (
            <div className="h-72 rounded-xl overflow-hidden border mb-4">
              <MapInner points={mapPoints} />
            </div>
          ) : (
            <div className="h-40 rounded-xl border border-dashed border-slate-300 bg-slate-50 mb-4 flex items-center justify-center text-sm text-slate-400 px-4 text-center">
              Sin ubicaciones GPS. Los técnicos envían posición automáticamente al usar la app.
            </div>
          )}

          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3">Técnico</th>
                  <th className="text-left p-3">Estado</th>
                  <th className="text-left p-3">GPS</th>
                  <th className="text-left p-3 hidden sm:table-cell">Coordenadas</th>
                </tr>
              </thead>
              <tbody>
                {tecnicosMapa.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="p-3 font-medium">{t.nombre}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.estado === "TRABAJANDO"
                            ? "bg-blue-100 text-blue-800"
                            : t.estado === "DISPONIBLE"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {ESTADO_TECNICO_LABELS[t.estado]}
                      </span>
                    </td>
                    <td className="p-3">
                      {t.enVivo ? (
                        <span className="text-xs font-semibold text-emerald-700">
                          En vivo{t.ageSec != null ? ` (${t.ageSec}s)` : ""}
                        </span>
                      ) : t.lat != null && t.lng != null ? (
                        <span className="text-xs text-amber-700">
                          Antigua{t.ageSec != null ? ` · ${t.ageSec}s` : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Sin señal</span>
                      )}
                    </td>
                    <td className="p-3 hidden sm:table-cell text-slate-500 text-xs">
                      {t.lat != null && t.lng != null
                        ? `${t.lat.toFixed(4)}, ${t.lng.toFixed(4)}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Tickets activos */}
        <section>
          <h2 className="font-semibold mb-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Tickets activos
            {data.tickets.some((t) => t.novedadPendiente) && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                ! Novedades pendientes
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Semáforo: amarillo leído · azul en proceso · verde terminado. Si no aparecen en la
            app del técnico, abra{" "}
            <Link href="/supervisor/asignaciones" className="text-infinity-600 font-medium underline">
              Destinar tickets → Actualizar y enviar a apps
            </Link>
            .
          </p>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3">Ticket</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3 hidden sm:table-cell">Técnicos</th>
                  <th className="text-left p-3">Prioridad</th>
                  <th className="text-left p-3">Semáforo</th>
                  <th className="text-left p-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.tickets.map((t) => (
                  <tr
                    key={t.id}
                    className={`border-t ${t.novedadPendiente ? "bg-amber-50/80" : ""}`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {t.novedadPendiente && (
                          <Link
                            href="/supervisor/novedades"
                            title={t.novedadLabel || "Novedad de soporte pendiente"}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-sm font-bold shrink-0 hover:bg-amber-600"
                            aria-label={`Novedad: ${t.novedadLabel || "pendiente de revisión"}`}
                          >
                            !
                          </Link>
                        )}
                        <span className="font-semibold text-infinity-600">{t.codigo}</span>
                      </div>
                    </td>
                    <td className="p-3">{t.cliente.nombre}</td>
                    <td className="p-3 hidden sm:table-cell text-xs leading-snug">
                      {t.tecnicosLabel}
                    </td>
                    <td className="p-3">{PRIORIDAD_LABELS[t.prioridad]}</td>
                    <td className="p-3">
                      <TicketSemaforo estado={t.estado} />
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {t.novedadPendiente && (
                          <Link
                            href="/supervisor/novedades"
                            className="text-xs font-medium text-amber-700 hover:underline whitespace-nowrap"
                          >
                            Revisar novedad
                          </Link>
                        )}
                        <Link
                          href={`/supervisor/tickets/${t.id}/editar`}
                          className="text-xs font-medium text-infinity-600 hover:underline whitespace-nowrap"
                        >
                          Editar →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <div className="max-w-6xl mx-auto px-4 pb-4">
        <GitShaBadge />
      </div>
    </div>
  );
}
