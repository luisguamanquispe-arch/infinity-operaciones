"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { SI_TIPO_TRABAJO_LABELS } from "@/lib/ticket-infraestructura";

type StatsPayload = {
  kpis: {
    pendientes: number;
    asignadas: number;
    enProceso: number;
    finalizadas: number;
    criticas: number;
    tiempoPromedioMin: number | null;
  };
  estadisticas: {
    trabajosPorTecnico: { nombre: string; total: number }[];
    trabajosPorTipo: { tipo: string; total: number }[];
    sectoresIncidencia: { sector: string; total: number }[];
    materialesMasUsados: { material: string; cantidad: number }[];
    tiempoPromedioMin: number | null;
    ordenesAbiertas: number;
    ordenesFinalizadas: number;
  };
};

function BarList({
  items,
  labelKey,
  valueKey,
}: {
  items: Record<string, string | number>[];
  labelKey: string;
  valueKey: string;
}) {
  const max = Math.max(1, ...items.map((i) => Number(i[valueKey]) || 0));
  return (
    <ul className="space-y-2">
      {items.map((item, idx) => {
        const val = Number(item[valueKey]) || 0;
        return (
          <li key={idx} className="text-sm">
            <div className="flex justify-between gap-2 mb-0.5">
              <span className="truncate">{String(item[labelKey])}</span>
              <span className="tabular-nums font-medium">{val}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-600 rounded-full"
                style={{ width: `${(val / max) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function SiEstadisticasPage() {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/soporte-infraestructura/estadisticas")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Error");
        setData(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Estadísticas" subtitle="Soporte de Infraestructura" />
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <Link
          href="/supervisor/soporte-infraestructura"
          className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}
        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl">{error}</div>
        )}
        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ["Abiertas", data.estadisticas.ordenesAbiertas],
                ["Finalizadas", data.estadisticas.ordenesFinalizadas],
                [
                  "Tiempo prom.",
                  data.estadisticas.tiempoPromedioMin != null
                    ? `${data.estadisticas.tiempoPromedioMin}m`
                    : "—",
                ],
                ["Críticas", data.kpis.criticas],
              ].map(([l, v]) => (
                <div key={String(l)} className="bg-white border rounded-xl p-3">
                  <p className="text-xs text-slate-500">{l}</p>
                  <p className="text-lg font-semibold tabular-nums">{v}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="bg-white border rounded-xl p-4">
                <h2 className="font-semibold mb-3">Trabajos por técnico</h2>
                <BarList
                  items={data.estadisticas.trabajosPorTecnico}
                  labelKey="nombre"
                  valueKey="total"
                />
              </section>
              <section className="bg-white border rounded-xl p-4">
                <h2 className="font-semibold mb-3">Trabajos por tipo</h2>
                <BarList
                  items={data.estadisticas.trabajosPorTipo.map((t) => ({
                    tipo:
                      SI_TIPO_TRABAJO_LABELS[
                        t.tipo as keyof typeof SI_TIPO_TRABAJO_LABELS
                      ] || t.tipo,
                    total: t.total,
                  }))}
                  labelKey="tipo"
                  valueKey="total"
                />
              </section>
              <section className="bg-white border rounded-xl p-4">
                <h2 className="font-semibold mb-3">Sectores con mayor incidencia</h2>
                <BarList
                  items={data.estadisticas.sectoresIncidencia}
                  labelKey="sector"
                  valueKey="total"
                />
              </section>
              <section className="bg-white border rounded-xl p-4">
                <h2 className="font-semibold mb-3">Materiales más utilizados</h2>
                <BarList
                  items={data.estadisticas.materialesMasUsados}
                  labelKey="material"
                  valueKey="cantidad"
                />
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
