"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Calendar,
  User,
  MapPin,
  ClipboardList,
  Clock,
  RefreshCw,
  CheckCircle2,
  X,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { DeployVersionBanner } from "@/components/DeployVersionBanner";
import { GitShaBadge } from "@/components/GitShaBadge";
import { StatCard } from "@/components/StatCard";
import { TecnicoOrdenesPendientes } from "@/components/tecnico/TecnicoOrdenesPendientes";
import type { OrdenPendiente } from "@/components/tecnico/TecnicoOrdenesPendientes";
import { TecnicoAgenda } from "@/components/TecnicoAgenda";
import { TecnicoDashboardSkeleton } from "@/components/tecnico/TecnicoDashboardSkeleton";
import { formatDate } from "@/lib/utils";
import { fetchWithRetry } from "@/lib/compress-image";
import { useTecnicoGpsTracking } from "@/hooks/useTecnicoGpsTracking";

const WorkMap = dynamic(
  () => import("@/components/WorkMap").then((m) => m.WorkMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 bg-slate-100 rounded-xl animate-pulse flex items-center justify-center text-slate-400 text-sm">
        Cargando mapa…
      </div>
    ),
  }
);

interface Resumen {
  fecha: string;
  tecnico: string;
  ubicacion: { lat: number; lng: number } | null;
  programadasHoy: number;
  pendientes: number;
  enProceso: number;
  finalizadas: number;
  tiempoPromedioMin: number;
}

interface AgendaTicket {
  id: string;
  codigo: string;
  tipo: string;
  prioridad: string;
  estado: string;
  programadoEn: string;
  motivo?: string | null;
  cliente: {
    nombre: string;
    sector: string;
    direccion: string;
    lat?: number | null;
    lng?: number | null;
  };
}

export default function TecnicoDashboard() {
  const [bannerCerrado, setBannerCerrado] = useState<string | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [ordenesPendientes, setOrdenesPendientes] = useState<OrdenPendiente[]>([]);
  const [agenda, setAgenda] = useState<AgendaTicket[]>([]);
  const [proximaOrden, setProximaOrden] = useState<AgendaTicket | null>(null);
  const [activosMapa, setActivosMapa] = useState<AgendaTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showMap, setShowMap] = useState(false);

  useTecnicoGpsTracking(true);

  useEffect(() => {
    const codigo = new URLSearchParams(window.location.search).get("cerrado");
    if (codigo) setBannerCerrado(codigo);
  }, []);

  const cargar = useCallback(async () => {
    setError("");
    try {
      const res = await fetchWithRetry(
        `/api/tecnico/dashboard`,
        { method: "GET", cache: "no-store", credentials: "include" },
        3
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          res.status === 503
            ? "El servidor está iniciando. Espere unos segundos e intente de nuevo."
            : data.error || "No se pudo cargar el panel"
        );
        return;
      }
      setResumen(data.resumen);
      setOrdenesPendientes(data.ordenesPendientes ?? data.tickets ?? []);
      setAgenda(data.agenda ?? []);
      setProximaOrden(data.proximaOrden ?? null);
      setActivosMapa(data.activosMapa ?? []);
    } catch {
      setError("Sin conexión. Verifique internet e intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    cargar();
  }, [cargar]);

  // Refresco de tickets activos (GPS lo envía useTecnicoGpsTracking)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void cargar();
    }, 30000);
    return () => window.clearInterval(id);
  }, [cargar]);

  useEffect(() => {
    const t = window.setTimeout(() => setShowMap(true), 400);
    return () => window.clearTimeout(t);
  }, []);

  const clientesMapa = useMemo(
    () =>
      activosMapa.map((t) => ({
        lat: t.cliente.lat ?? null,
        lng: t.cliente.lng ?? null,
        nombre: t.cliente.nombre,
        codigo: t.codigo,
      })),
    [activosMapa]
  );

  if (loading && !resumen) {
    return <TecnicoDashboardSkeleton />;
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <DeployVersionBanner />
      <AppHeader title="Infinity Técnicos" subtitle="Panel del Técnico" />

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        {bannerCerrado && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-900">
                Ticket {bannerCerrado} cerrado — reporte finalizado
              </p>
              <p className="text-xs text-emerald-800/80 mt-1">
                El supervisor puede verlo en Reportes finalizados.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBannerCerrado(null)}
              className="p-1 rounded-lg text-emerald-700 hover:bg-emerald-100"
              aria-label="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-amber-900 flex-1">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                cargar();
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-infinity-600 text-white rounded-lg text-sm font-medium shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </button>
          </div>
        )}

        <section className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="w-4 h-4" />
            <span className="capitalize">{resumen && formatDate(resumen.fecha)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-infinity-600" />
            <span className="font-medium">Técnico: {resumen?.tecnico}</span>
          </div>
          {resumen?.ubicacion ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <MapPin className="w-4 h-4" />
              <span>
                GPS activo: {resumen.ubicacion.lat.toFixed(4)},{" "}
                {resumen.ubicacion.lng.toFixed(4)} · enviando al supervisor
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <MapPin className="w-4 h-4" />
              <span>
                Active la ubicación del celular para aparecer en el mapa del supervisor
              </span>
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Programadas hoy"
            value={resumen?.programadasHoy ?? 0}
            icon={ClipboardList}
            color="blue"
          />
          <StatCard label="Pendientes" value={resumen?.pendientes ?? 0} color="yellow" />
          <StatCard label="En proceso" value={resumen?.enProceso ?? 0} color="blue" />
          <StatCard label="Finalizadas hoy" value={resumen?.finalizadas ?? 0} color="green" />
        </div>

        <TecnicoAgenda tickets={agenda} proximaOrden={proximaOrden} />

        <div className="flex items-center gap-2 text-sm text-slate-600 bg-white rounded-xl border p-3">
          <Clock className="w-4 h-4" />
          <span>
            Tiempo promedio de reparación:{" "}
            <strong>{resumen?.tiempoPromedioMin ?? 0} min</strong>
          </span>
        </div>

        {showMap && (
          <section>
            <h2 className="font-semibold mb-3">Mapa de trabajos</h2>
            <WorkMap tecnicoLocation={resumen?.ubicacion} clientes={clientesMapa} />
          </section>
        )}

        <section>
          <h2 className="font-semibold mb-1">Mis órdenes de trabajo</h2>
          <p className="text-sm text-slate-500 mb-3">
            Tickets activos (pendientes y en proceso) destinados a usted
          </p>
          <TecnicoOrdenesPendientes ordenes={ordenesPendientes} />
        </section>
      </main>
      <div className="max-w-6xl mx-auto px-4 pb-4">
        <GitShaBadge />
      </div>
    </div>
  );
}
