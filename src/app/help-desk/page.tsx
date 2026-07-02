"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Headphones,
  Loader2,
  MessageSquare,
  Smile,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { fetchJson } from "@/lib/fetch-json-client";

type Kpis = {
  agentesConectados: number;
  clientesEnEspera: number;
  conversacionesActivas: number;
  tiempoPromedioAtencionMin: number;
  ticketsAbiertos: number;
  escaladosHoy: number;
  resueltosRemotoHoy: number;
  slaEnRiesgo: number;
  satisfaccionPromedio: number | null;
};

export default function HelpDeskDashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data, error: err } = await fetchJson<{ kpis: Kpis }>("/api/help-desk/dashboard");
      if (err || !data?.kpis) {
        setError(err || "No se pudo cargar el panel");
      } else {
        setKpis(data.kpis);
        setError("");
      }
      setLoading(false);
    }
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (error || !kpis) {
    return (
      <div className="p-6 text-center text-red-600 dark:text-red-400">
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-2 text-teal-600 underline">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Centro de Soporte Remoto</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Métricas en tiempo real — resolución N1 sin visitas
          </p>
        </div>
        <Link
          href="/help-desk/cola"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm"
        >
          <MessageSquare className="w-4 h-4" />
          Ir a cola de atención
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Técnicos conectados" value={kpis.agentesConectados} icon={Users} color="blue" />
        <StatCard label="Clientes en espera" value={kpis.clientesEnEspera} icon={Headphones} color="yellow" />
        <StatCard label="Conversaciones activas" value={kpis.conversacionesActivas} icon={MessageSquare} color="green" />
        <StatCard label="Tiempo prom. atención" value={`${kpis.tiempoPromedioAtencionMin} min`} icon={Clock} color="slate" />
        <StatCard label="Tickets abiertos" value={kpis.ticketsAbiertos} icon={Ticket} color="blue" />
        <StatCard label="Escalados hoy" value={kpis.escaladosHoy} icon={TrendingUp} color="red" />
        <StatCard label="Resueltos remoto hoy" value={kpis.resueltosRemotoHoy} icon={TrendingUp} color="green" />
        <StatCard
          label="Satisfacción"
          value={kpis.satisfaccionPromedio ?? "—"}
          icon={Smile}
          color="slate"
        />
      </div>

      {kpis.slaEnRiesgo > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 p-4 text-sm">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            {kpis.slaEnRiesgo} conversación(es) requieren atención prioritaria
          </p>
        </div>
      )}
    </div>
  );
}
