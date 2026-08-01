"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { formatTiempoMinutos } from "@/lib/soporte-remoto/labels";

type Stats = {
  total: number;
  tiempoPromedioMin: number | null;
  porDia: { fecha: string; cantidad: number }[];
  tiposFrecuentes: { tipo: string; label: string; cantidad: number }[];
  operadores: { nombre: string; cantidad: number }[];
  clientesTop: { nombre: string; codigo: string; cantidad: number }[];
  escaladosVisita: number;
  resultadosEscalados: {
    requiereVisita: number;
    escaladoTecnico: number;
  };
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
      const res = await fetch(`/api/soporte-remoto/estadisticas?${params}`);
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
      <AppHeader title="Estadísticas" subtitle="Soporte Remoto — productividad" />
      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <Link
          href="/soporte-remoto"
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
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-slate-500">Total atenciones</p>
                <p className="text-2xl font-semibold">{stats.total}</p>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-slate-500">Tiempo promedio</p>
                <p className="text-2xl font-semibold">
                  {formatTiempoMinutos(stats.tiempoPromedioMin)}
                </p>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-slate-500">Escalados / visita</p>
                <p className="text-2xl font-semibold">{stats.escaladosVisita}</p>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-slate-500">Requieren visita</p>
                <p className="text-2xl font-semibold">
                  {stats.resultadosEscalados.requiereVisita}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <section className="bg-white rounded-xl border overflow-hidden">
                <h2 className="font-semibold p-4 border-b">Por día</h2>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left p-3">Fecha</th>
                      <th className="text-left p-3">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.porDia.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="p-3 text-slate-500">
                          Sin datos
                        </td>
                      </tr>
                    ) : (
                      stats.porDia.map((d) => (
                        <tr key={d.fecha} className="border-t">
                          <td className="p-3">{d.fecha}</td>
                          <td className="p-3">{d.cantidad}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </section>

              <section className="bg-white rounded-xl border overflow-hidden">
                <h2 className="font-semibold p-4 border-b">Tipos más frecuentes</h2>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left p-3">Tipo</th>
                      <th className="text-left p-3">Cantidad</th>
                    </tr>
                  </thead>
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
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left p-3">Operador</th>
                      <th className="text-left p-3">Atenciones</th>
                    </tr>
                  </thead>
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
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left p-3">Cliente</th>
                      <th className="text-left p-3">Código</th>
                      <th className="text-left p-3">Incidencias</th>
                    </tr>
                  </thead>
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
