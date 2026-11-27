"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, AlertTriangle, CheckCircle, Clock, Users } from "lucide-react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { StatCard } from "@/components/StatCard";
import { TicketSemaforo } from "@/components/TicketSemaforo";
import { SemaforoTiempo } from "@/components/SemaforoTiempo";
import { GitShaBadge } from "@/components/GitShaBadge";
import { SupervisorHomeTiles } from "@/components/ModuleQuickNav";
import { SystemDateTimeBar } from "@/components/SystemDateTimeBar";
import { ESTADO_TECNICO_LABELS, PRIORIDAD_LABELS, formatDateTime } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json-client";
import { faseSemaforoTiempo, diasDesdeReferencia } from "@/lib/ticket-antiguedad";
import { TiempoAtencionCell } from "@/components/TiempoAtencionCell";
import type { CronometroAtencionView } from "@/lib/cronometro-atencion/estado";
import { ConfirmacionVisitaBadge } from "@/components/ConfirmacionVisitaBadge";
import type { ConfirmacionVisitaView } from "@/lib/confirmacion-visita/reglas";

const MapInner = dynamic(() => import("@/components/MapInner"), {
  ssr: false,
  loading: () => <div className="h-64 bg-slate-100 animate-pulse rounded-xl" />,
});

interface RiesgoBajaDash {
  id: string;
  codigo: string;
  prioridad: string;
  estado: string;
  motivo: string | null;
  createdAt: string;
  minutosDesdeCreacion: number;
  cliente: { nombre: string; sector: string | null };
  tecnicosLabel: string;
  clienteRiesgoBajaMotivo: string | null;
  clienteRiesgoBajaActivadoEn: string | null;
  activadoPorNombre: string | null;
}

interface DashboardData {
  serverNow?: string;
  kpis: {
    abiertos: number;
    cerrados: number;
    vencidos: number;
    noAtendidos?: number;
    tiempoPromedioMin: number;
    primeraVisitaPct: number;
    riesgoBaja?: number;
  };
  riesgoBaja?: RiesgoBajaDash[];
  soporteInfra?: {
    pendientes: number;
    asignadas: number;
    enProceso: number;
    finalizadas: number;
    criticas: number;
    tiempoPromedioMin: number | null;
    tecnicosDisponibles: number;
    tecnicosEnCampo: number;
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
    clienteRiesgoBaja?: boolean;
    createdAt?: string;
    programadoEn?: string | null;
    motivo?: string | null;
    ultimaActividad?: { descripcion: string; fecha: string } | null;
    cronometroAtencion?: CronometroAtencionView | null;
    puedeIniciarLectura?: boolean;
    confirmacionVisita?: ConfirmacionVisitaView | null;
    cliente: { nombre: string; sector: string | null };
    tecnicosLabel: string;
    novedadPendiente?: boolean;
    novedadLabel?: string | null;
  }[];
}

function formatMinutosTranscurridos(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export default function SupervisorDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
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
        if (json.serverNow) {
          const srv = new Date(json.serverNow).getTime();
          if (!Number.isNaN(srv)) setClockOffsetMs(srv - Date.now());
        }
        setError("");
      }
      setLoading(false);
    }
    load();

    const interval = setInterval(async () => {
      const { data: json } = await fetchJson<DashboardData>("/api/supervisor/dashboard");
      if (json?.kpis) {
        setData(json);
        if (json.serverNow) {
          const srv = new Date(json.serverNow).getTime();
          if (!Number.isNaN(srv)) setClockOffsetMs(srv - Date.now());
        }
      }
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
        <SystemDateTimeBar variant="card" />

        <SupervisorHomeTiles />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Abiertos" value={data.kpis.abiertos} color="blue" />
          <StatCard label="Cerrados hoy" value={data.kpis.cerrados} color="green" />
          <StatCard label="Vencidos SLA" value={data.kpis.vencidos} color="red" />
          <Link href="/supervisor/no-atendidos" className="block">
            <StatCard
              label="No atendidos +4d"
              value={data.kpis.noAtendidos ?? 0}
              color="red"
              icon={AlertTriangle}
            />
          </Link>
          <a href="#riesgo-baja" className="block">
            <StatCard
              label="Riesgo de baja"
              value={data.kpis.riesgoBaja ?? data.riesgoBaja?.length ?? 0}
              color="red"
              icon={AlertTriangle}
            />
          </a>
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

        {data.soporteInfra && (
          <section>
            <h2 className="font-semibold text-sm mb-2">Soporte de Infraestructura</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatCard label="Pendientes" value={data.soporteInfra.pendientes} color="slate" />
              <StatCard label="Asignadas" value={data.soporteInfra.asignadas} color="blue" />
              <StatCard label="En proceso" value={data.soporteInfra.enProceso} color="yellow" />
              <StatCard label="Finalizadas" value={data.soporteInfra.finalizadas} color="green" />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Abrir módulo desde la barra superior → Infraestructura
            </p>
          </section>
        )}

        {(data.riesgoBaja?.length ?? 0) > 0 && (
          <section id="riesgo-baja">
            <h2 className="font-semibold mb-1 flex items-center gap-2 text-red-900">
              <AlertTriangle className="w-5 h-5 text-red-700" />
              Clientes en riesgo de baja
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              Intención de cancelar registrada por el agente. Prioridad ALTA. Gestione desde
              Editar ticket.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[44rem]">
                  <thead className="bg-red-100/80">
                    <tr>
                      <th className="text-left p-3">Ticket</th>
                      <th className="text-left p-3">Cliente</th>
                      <th className="text-left p-3">Motivo técnico</th>
                      <th className="text-left p-3 hidden sm:table-cell">Técnico</th>
                      <th className="text-left p-3">Tiempo</th>
                      <th className="text-left p-3">Prioridad</th>
                      <th className="text-left p-3 hidden md:table-cell">Alerta por</th>
                      <th className="text-left p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.riesgoBaja!.map((r) => (
                      <tr key={r.id} className="border-t border-red-100">
                        <td className="p-3">
                          <span className="font-semibold text-red-800">{r.codigo}</span>
                          <span className="ml-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-200 text-red-900">
                            Riesgo baja
                          </span>
                        </td>
                        <td className="p-3 max-w-[10rem] min-w-0">
                          <p className="truncate font-medium">{r.cliente.nombre}</p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {r.cliente.sector
                              ? `Sector: ${r.cliente.sector}`
                              : "Sector no especificado"}
                          </p>
                        </td>
                        <td className="p-3 max-w-[14rem] min-w-0">
                          <span className="block truncate text-slate-700" title={r.motivo || ""}>
                            {r.motivo || "—"}
                          </span>
                        </td>
                        <td className="p-3 hidden sm:table-cell text-xs">{r.tecnicosLabel}</td>
                        <td className="p-3 whitespace-nowrap">
                          {formatMinutosTranscurridos(r.minutosDesdeCreacion)}
                        </td>
                        <td className="p-3 text-red-800 font-semibold">
                          {PRIORIDAD_LABELS[r.prioridad] || r.prioridad}
                        </td>
                        <td className="p-3 hidden md:table-cell text-xs">
                          {r.activadoPorNombre || "—"}
                          {r.clienteRiesgoBajaActivadoEn && (
                            <p className="text-[11px] text-slate-500">
                              {formatDateTime(r.clienteRiesgoBajaActivadoEn)}
                            </p>
                          )}
                        </td>
                        <td className="p-3">
                          <Link
                            href={`/supervisor/tickets/${r.id}/editar`}
                            className="text-xs font-medium text-red-800 hover:underline whitespace-nowrap"
                          >
                            Gestionar →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

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
            <Link
              href="/supervisor/confirmaciones"
              className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg bg-infinity-50 text-infinity-700 border border-infinity-200 hover:bg-infinity-100"
            >
              Confirmaciones de visita →
            </Link>
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Semáforo de estado: amarillo leído · azul en proceso · verde terminado. Semáforo de
            tiempo: verde 0–2d · amarillo 2–4d. Tras 4 días sin atención pasan a{" "}
            <Link href="/supervisor/no-atendidos" className="text-red-700 font-medium underline">
              No atendidos
            </Link>
            . Si no aparecen en la app del técnico, abra{" "}
            <Link href="/supervisor/asignaciones" className="text-infinity-600 font-medium underline">
              Destinar tickets → Actualizar y enviar a apps
            </Link>
            .
          </p>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[64rem]">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="text-left px-2.5 py-2.5 whitespace-nowrap">Ticket</th>
                    <th className="text-left px-2.5 py-2.5 whitespace-nowrap">Cliente</th>
                    <th className="text-left px-2.5 py-2.5 whitespace-nowrap">Motivo del ticket</th>
                    <th className="text-left px-2.5 py-2.5 hidden sm:table-cell whitespace-nowrap">Técnicos</th>
                    <th className="text-left px-2.5 py-2.5 whitespace-nowrap">Prioridad</th>
                    <th className="text-left px-2.5 py-2.5 whitespace-nowrap">Estado</th>
                    <th className="text-left px-2.5 py-2.5 whitespace-nowrap">Tiempo de atención</th>
                    <th className="text-left px-2.5 py-2.5 whitespace-nowrap">Tiempo</th>
                    <th className="text-left px-2.5 py-2.5 hidden lg:table-cell whitespace-nowrap">Última actividad</th>
                    <th className="text-right px-2.5 py-2.5 whitespace-nowrap sticky right-0 z-10 bg-slate-50 border-l border-slate-200/80">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.tickets.map((t) => {
                    const ref = {
                      createdAt: t.createdAt || new Date().toISOString(),
                      programadoEn: t.programadoEn,
                    };
                    const faseT = faseSemaforoTiempo(ref);
                    const diasT = diasDesdeReferencia(ref);
                    const stickyCellBg = t.novedadPendiente ? "bg-amber-50" : "bg-white";
                    return (
                    <tr
                      key={t.id}
                      className={`border-t align-top ${t.novedadPendiente ? "bg-amber-50/80" : "bg-white"}`}
                    >
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
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
                        {t.confirmacionVisita &&
                          t.confirmacionVisita.estado !== "HISTORICO_SIN_CONTROL" && (
                            <div className="mt-1">
                              <ConfirmacionVisitaBadge
                                confirmacion={t.confirmacionVisita}
                                compact
                              />
                            </div>
                          )}
                      </td>
                      <td className="px-2.5 py-2.5 max-w-[11rem] min-w-[8.5rem]">
                        <div className="min-w-0">
                          <p
                            className="truncate text-slate-800 font-medium"
                            title={t.cliente.nombre}
                          >
                            {t.cliente.nombre}
                          </p>
                          <p
                            className="text-[11px] text-slate-400 truncate"
                            title={
                              t.cliente.sector
                                ? `Sector: ${t.cliente.sector}`
                                : "Sector no especificado"
                            }
                          >
                            {t.cliente.sector
                              ? `Sector: ${t.cliente.sector}`
                              : "Sector no especificado"}
                          </p>
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5 max-w-[13rem] min-w-[9rem]">
                        {t.motivo ? (
                          <span
                            className="block min-w-0 truncate text-slate-700"
                            title={t.motivo}
                          >
                            {t.motivo}
                          </span>
                        ) : (
                          <span className="text-slate-400">Sin motivo especificado</span>
                        )}
                      </td>
                      <td className="px-2.5 py-2.5 hidden sm:table-cell text-xs leading-snug max-w-[9rem] truncate" title={t.tecnicosLabel}>
                        {t.tecnicosLabel}
                      </td>
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-1">
                          <span
                            className={
                              t.prioridad === "ALTA"
                                ? "text-red-700 font-semibold"
                                : undefined
                            }
                          >
                            {PRIORIDAD_LABELS[t.prioridad]}
                          </span>
                          {t.prioridad === "ALTA" && (
                            <span className="text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 whitespace-nowrap">
                              ALTA
                            </span>
                          )}
                          {t.clienteRiesgoBaja && (
                            <span className="text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-red-600 text-white whitespace-nowrap">
                              Riesgo baja
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <TicketSemaforo estado={t.estado} />
                      </td>
                      <td className="px-2.5 py-2.5 min-w-[9.5rem]">
                        {t.cronometroAtencion ? (
                          <TiempoAtencionCell
                            ticketId={t.id}
                            cronometro={t.cronometroAtencion}
                            clockOffsetMs={clockOffsetMs}
                            puedeIniciarLectura={Boolean(t.puedeIniciarLectura)}
                          />
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <SemaforoTiempo fase={faseT} dias={diasT} />
                      </td>
                      <td className="px-2.5 py-2.5 hidden lg:table-cell max-w-[10.5rem] min-w-0">
                        {t.ultimaActividad ? (
                          <div
                            className="min-w-0"
                            title={`${t.ultimaActividad.descripcion} · ${formatDateTime(t.ultimaActividad.fecha)}`}
                          >
                            <p className="truncate text-slate-700 capitalize">
                              {t.ultimaActividad.descripcion.toLowerCase()}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {formatDateTime(t.ultimaActividad.fecha)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400">Sin actividad registrada</span>
                        )}
                      </td>
                      <td
                        className={`px-2.5 py-2.5 text-right whitespace-nowrap sticky right-0 z-10 border-l border-slate-100 ${stickyCellBg}`}
                      >
                        <div className="flex flex-col items-end gap-1">
                          <Link
                            href={`/supervisor/tickets/${t.id}/editar`}
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold text-infinity-700 bg-infinity-50 hover:bg-infinity-100 border border-infinity-200 whitespace-nowrap"
                          >
                            Editar →
                          </Link>
                          {t.novedadPendiente && (
                            <Link
                              href="/supervisor/novedades"
                              className="text-[11px] font-medium text-amber-700 hover:underline whitespace-nowrap"
                            >
                              Revisar novedad
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
      <div className="max-w-6xl mx-auto px-4 pb-4">
        <GitShaBadge />
      </div>
    </div>
  );
}
