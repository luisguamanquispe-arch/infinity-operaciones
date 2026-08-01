"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Search, Network } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import {
  IR_ESTADO_LABELS,
  IR_ESTADOS,
  IR_TIPO_TRABAJO_LABELS,
} from "@/lib/infraestructura-red/labels";

type ReporteRow = {
  id: string;
  codigo: string;
  fecha: string;
  estado: keyof typeof IR_ESTADO_LABELS;
  tipoTrabajo: keyof typeof IR_TIPO_TRABAJO_LABELS;
  sector: string;
  tecnico: { usuario: { nombre: string } };
};

export default function InfraestructuraListPage() {
  const [reportes, setReportes] = useState<ReporteRow[]>([]);
  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [sector, setSector] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [desde, setDesde] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/infraestructura/catalogo")
      .then((r) => r.json())
      .then((d) => setTecnicos(d.tecnicos || []))
      .catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ take: "80" });
    if (q.trim()) params.set("q", q.trim());
    if (estado) params.set("estado", estado);
    if (sector.trim()) params.set("sector", sector.trim());
    if (tecnicoId) params.set("tecnicoId", tecnicoId);
    if (desde) params.set("desde", new Date(desde).toISOString());
    try {
      const res = await fetch(`/api/infraestructura/reportes?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      setReportes(data.reportes || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setReportes([]);
    } finally {
      setLoading(false);
    }
  }, [q, estado, sector, tecnicoId, desde]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader
        title="Infraestructura de Red"
        subtitle="Reportes de trabajos sobre la red de fibra óptica"
      />

      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Módulo independiente (no altera tickets de soporte INF-*).
          </p>
          <Link
            href="/infraestructura/nuevo"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-infinity-600 text-white text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nuevo reporte
          </Link>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void cargar();
          }}
          className="bg-white rounded-xl border p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar código, sector…"
              className="w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm"
            />
          </div>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="px-3 py-2.5 border rounded-xl text-sm"
            title="Desde fecha"
          />
          <select
            value={tecnicoId}
            onChange={(e) => setTecnicoId(e.target.value)}
            className="px-3 py-2.5 border rounded-xl text-sm"
          >
            <option value="">Todos los técnicos</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
          <input
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            placeholder="Sector"
            className="px-3 py-2.5 border rounded-xl text-sm"
          />
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="px-3 py-2.5 border rounded-xl text-sm"
          >
            <option value="">Todos los estados</option>
            {IR_ESTADOS.map((e) => (
              <option key={e} value={e}>
                {IR_ESTADO_LABELS[e]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="py-2.5 rounded-xl bg-slate-800 text-white text-sm font-medium"
          >
            Filtrar
          </button>
        </form>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
          </div>
        ) : reportes.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Network className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>No hay reportes con esos filtros.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left p-3 font-medium">Número</th>
                    <th className="text-left p-3 font-medium">Fecha</th>
                    <th className="text-left p-3 font-medium">Técnico</th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">Tipo</th>
                    <th className="text-left p-3 font-medium">Sector</th>
                    <th className="text-left p-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {reportes.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-slate-50">
                      <td className="p-3">
                        <Link
                          href={`/infraestructura/${r.id}`}
                          className="font-semibold text-infinity-700 hover:underline"
                        >
                          {r.codigo}
                        </Link>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {new Date(r.fecha).toLocaleDateString("es-EC")}
                      </td>
                      <td className="p-3">{r.tecnico.usuario.nombre}</td>
                      <td className="p-3 hidden md:table-cell">
                        {IR_TIPO_TRABAJO_LABELS[r.tipoTrabajo]}
                      </td>
                      <td className="p-3">{r.sector}</td>
                      <td className="p-3">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            r.estado === "FINALIZADO"
                              ? "bg-emerald-100 text-emerald-800"
                              : r.estado === "EN_PROCESO"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {IR_ESTADO_LABELS[r.estado]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
