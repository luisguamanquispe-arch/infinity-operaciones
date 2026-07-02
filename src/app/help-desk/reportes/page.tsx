"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { fetchJson } from "@/lib/fetch-json-client";
import { HD_ACCION_LABELS } from "@/lib/help-desk/labels";
import type { HdTipoAccionRemota } from "@prisma/client";

type Reporte = {
  periodoDias: number;
  indicadores: {
    tiempoPromedioResolucionMin: number;
    resueltosRemoto: number;
    escalados: number;
    visitasEvitadas: number;
    cambiosPassword: number;
    configuraciones: number;
    clientesReincidentes: number;
    satisfaccionPromedio: number | null;
  };
  accionesPorTipo: { tipo: string; total: number }[];
  rankingAgentes: { nombre: string; resueltos: number; atenciones: number }[];
};

export default function ReportesHelpDeskPage() {
  const [data, setData] = useState<Reporte | null>(null);
  const [dias, setDias] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: json, error: err } = await fetchJson<Reporte>(`/api/help-desk/reportes?dias=${dias}`);
      if (err) setError(err);
      else {
        setData(json);
        setError("");
      }
      setLoading(false);
    }
    load();
  }, [dias]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (error) {
    return <p className="p-6 text-red-600">{error}</p>;
  }

  if (!data) return null;

  const { indicadores } = data;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Reportes Help Desk</h1>
          <p className="text-sm text-slate-500">Indicadores de desempeño remoto</p>
        </div>
        <select
          value={dias}
          onChange={(e) => setDias(parseInt(e.target.value, 10))}
          className="px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-700 text-sm"
        >
          <option value={7}>Últimos 7 días</option>
          <option value={30}>Últimos 30 días</option>
          <option value={90}>Últimos 90 días</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Tiempo prom. resolución" value={`${indicadores.tiempoPromedioResolucionMin} min`} color="blue" />
        <StatCard label="Resueltos remoto" value={indicadores.resueltosRemoto} color="green" />
        <StatCard label="Escalados" value={indicadores.escalados} color="red" />
        <StatCard label="Visitas evitadas" value={indicadores.visitasEvitadas} color="green" />
        <StatCard label="Cambios contraseña" value={indicadores.cambiosPassword} color="slate" />
        <StatCard label="Configuraciones" value={indicadores.configuraciones} color="slate" />
        <StatCard label="Clientes reincidentes" value={indicadores.clientesReincidentes} color="yellow" />
        <StatCard label="Satisfacción" value={indicadores.satisfaccionPromedio ?? "—"} color="blue" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h2 className="font-semibold mb-3">Ranking de agentes</h2>
          {data.rankingAgentes.length === 0 ? (
            <p className="text-sm text-slate-500">Sin datos en el período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b dark:border-slate-700">
                  <th className="pb-2">Agente</th>
                  <th className="pb-2">Resueltos</th>
                  <th className="pb-2">Atenciones</th>
                </tr>
              </thead>
              <tbody>
                {data.rankingAgentes.map((a) => (
                  <tr key={a.nombre} className="border-b dark:border-slate-800">
                    <td className="py-2">{a.nombre}</td>
                    <td>{a.resueltos}</td>
                    <td>{a.atenciones}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h2 className="font-semibold mb-3">Acciones remotas por tipo</h2>
          {data.accionesPorTipo.length === 0 ? (
            <p className="text-sm text-slate-500">Sin acciones registradas.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.accionesPorTipo.map((a) => (
                <li key={a.tipo} className="flex justify-between">
                  <span>{HD_ACCION_LABELS[a.tipo as HdTipoAccionRemota] ?? a.tipo}</span>
                  <span className="font-mono">{a.total}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
