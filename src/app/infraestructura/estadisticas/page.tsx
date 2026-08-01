"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { formatoTiempoMinutos } from "@/lib/infraestructura-red/labels";

type Stats = {
  kpis: {
    abiertos: number;
    enProceso: number;
    finalizados: number;
    preventivos: number;
    correctivos: number;
    kmRed: number;
    clientesAfectados: number;
    tiempoPromedioMin: number | null;
  };
  estadisticas: {
    trabajosPorMes: { mes: string; total: number }[];
    preventivos: number;
    correctivos: number;
    cortesPorSector: { sector: string; total: number }[];
    materialesMasUsados: { material: string; cantidad: number }[];
    tecnicosMasActivos: { nombre: string; total: number }[];
    tiempoPromedioMin: number | null;
    sectoresIncidencia: { sector: string; total: number }[];
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
              <span className="truncate text-slate-700">{String(item[labelKey])}</span>
              <span className="tabular-nums font-medium">{val}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-600 rounded-full"
                style={{ width: `${(val / max) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function IrEstadisticasPage() {
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/infraestructura/estadisticas")
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
      <AppHeader title="Estadísticas" subtitle="Infraestructura de Red" />
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <Link
          href="/infraestructura"
          className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        )}
        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl">{error}</div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ["Abiertos", data.kpis.abiertos],
                ["En proceso", data.kpis.enProceso],
                ["Finalizados", data.kpis.finalizados],
                ["Tiempo prom.", formatoTiempoMinutos(data.estadisticas.tiempoPromedioMin)],
                ["Preventivos", data.estadisticas.preventivos],
                ["Correctivos", data.estadisticas.correctivos],
                ["Km red", data.kpis.kmRed.toFixed(2)],
                ["Clientes af.", data.kpis.clientesAfectados],
              ].map(([label, value]) => (
                <div key={String(label)} className="bg-white border rounded-xl p-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-lg font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="bg-white border rounded-xl p-4">
                <h2 className="font-semibold mb-3">Trabajos por mes</h2>
                <BarList
                  items={data.estadisticas.trabajosPorMes}
                  labelKey="mes"
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
                <h2 className="font-semibold mb-3">Cortes de fibra por sector</h2>
                {data.estadisticas.cortesPorSector.length === 0 ? (
                  <p className="text-sm text-slate-500">Sin datos</p>
                ) : (
                  <BarList
                    items={data.estadisticas.cortesPorSector}
                    labelKey="sector"
                    valueKey="total"
                  />
                )}
              </section>
              <section className="bg-white border rounded-xl p-4">
                <h2 className="font-semibold mb-3">Materiales más utilizados</h2>
                {data.estadisticas.materialesMasUsados.length === 0 ? (
                  <p className="text-sm text-slate-500">Sin datos</p>
                ) : (
                  <BarList
                    items={data.estadisticas.materialesMasUsados}
                    labelKey="material"
                    valueKey="cantidad"
                  />
                )}
              </section>
              <section className="bg-white border rounded-xl p-4 md:col-span-2">
                <h2 className="font-semibold mb-3">Técnicos con más intervenciones</h2>
                {data.estadisticas.tecnicosMasActivos.length === 0 ? (
                  <p className="text-sm text-slate-500">Sin datos</p>
                ) : (
                  <BarList
                    items={data.estadisticas.tecnicosMasActivos}
                    labelKey="nombre"
                    valueKey="total"
                  />
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
