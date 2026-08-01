"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { formatTiempoMinutos } from "@/lib/soporte-remoto/labels";

type Stats = {
  total: number;
  diarios: number;
  mensuales: number;
  tiempoPromedioMin: number | null;
  resueltosRemoto: number;
  enviadosVisita: number;
  porDia: { fecha: string; cantidad: number }[];
  tiposFrecuentes: { tipo: string; label: string; cantidad: number }[];
  operadores: { nombre: string; cantidad: number }[];
  clientesTop: { nombre: string; codigo: string; cantidad: number }[];
};

export default function SrEstadisticasPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (desde) params.set("desde", new Date(desde).toISOString());
    if (hasta) {
      const d = new Date(hasta);
      d.setHours(23, 59, 59, 999);
      params.set("hasta", d.toISOString());
    }
    try {
      const res = await fetch(`/api/help-desk/estadisticas?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setStats(data.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Estadísticas" subtitle="Soporte Remoto" />
      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <Link
          href="/help-desk"
          className="inline-flex items-center gap-1 text-sm text-teal-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Listado
        </Link>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void cargar();
          }}
          className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-end"
        >
          <label className="text-sm space-y-1">
            <span className="text-slate-600">Desde</span>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="block px-3 py-2 border rounded-lg"
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-slate-600">Hasta</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="block px-3 py-2 border rounded-lg"
            />
          </label>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium"
          >
            Aplicar
          </button>
        </form>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl border">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                ["Hoy", stats.diarios],
                ["Este mes", stats.mensuales],
                ["Total periodo", stats.total],
                ["Tiempo prom.", formatTiempoMinutos(stats.tiempoPromedioMin)],
                ["Resueltos remoto", stats.resueltosRemoto],
                ["A visita técnica", stats.enviadosVisita],
              ].map(([label, value]) => (
                <div key={String(label)} className="bg-white rounded-xl border p-4">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-xl font-semibold">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <section className="bg-white rounded-xl border overflow-hidden">
                <h2 className="font-semibold p-4 border-b">Por día</h2>
                <table className="w-full text-sm">
                  <tbody>
                    {stats.porDia.map((d) => (
                      <tr key={d.fecha} className="border-t">
                        <td className="p-3">{d.fecha}</td>
                        <td className="p-3">{d.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <section className="bg-white rounded-xl border overflow-hidden">
                <h2 className="font-semibold p-4 border-b">Motivos frecuentes</h2>
                <table className="w-full text-sm">
                  <tbody>
                    {stats.tiposFrecuentes.map((t) => (
                      <tr key={t.tipo} className="border-t">
                        <td className="p-3">{t.label}</td>
                        <td className="p-3">{t.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <section className="bg-white rounded-xl border overflow-hidden">
                <h2 className="font-semibold p-4 border-b">Operadores</h2>
                <table className="w-full text-sm">
                  <tbody>
                    {stats.operadores.map((o) => (
                      <tr key={o.nombre} className="border-t">
                        <td className="p-3">{o.nombre}</td>
                        <td className="p-3">{o.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <section className="bg-white rounded-xl border overflow-hidden">
                <h2 className="font-semibold p-4 border-b">Clientes con más incidencias</h2>
                <table className="w-full text-sm">
                  <tbody>
                    {stats.clientesTop.map((c) => (
                      <tr key={c.codigo} className="border-t">
                        <td className="p-3">{c.nombre}</td>
                        <td className="p-3">{c.codigo}</td>
                        <td className="p-3">{c.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
