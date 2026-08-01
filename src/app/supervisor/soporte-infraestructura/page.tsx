"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Loader2, Plus, Search } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { StatCard } from "@/components/StatCard";
import {
  SI_ESTADO_LABELS,
  SI_TIPOS_TRABAJO,
  SI_TIPO_TRABAJO_LABELS,
} from "@/lib/ticket-infraestructura";

type Kpis = {
  pendientes: number;
  asignadas: number;
  enProceso: number;
  finalizadas: number;
  criticas: number;
  tiempoPromedioMin: number | null;
  tecnicosDisponibles: number;
  tecnicosEnCampo: number;
};

type OrdenRow = {
  id: string;
  codigo: string;
  fecha: string;
  estadoLabel: string;
  prioridad: string;
  tipoLabel: string;
  sector: string;
  tecnicoResponsable: string;
  cantidadTecnicos: number;
};

export default function SoporteInfraestructuraListPage() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [ordenes, setOrdenes] = useState<OrdenRow[]>([]);
  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [siTipoTrabajo, setSiTipoTrabajo] = useState("");
  const [sector, setSector] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");

  useEffect(() => {
    void fetch("/api/tecnicos")
      .then((r) => r.json())
      .then((d) =>
        setTecnicos(
          (d.tecnicos || []).map((t: { id: string; nombre: string }) => ({
            id: t.id,
            nombre: t.nombre,
          }))
        )
      );
    void fetch("/api/soporte-infraestructura/kpis")
      .then((r) => r.json())
      .then((d) => setKpis(d.kpis || null))
      .catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ take: "80" });
    if (q.trim()) params.set("q", q.trim());
    if (estado) params.set("estado", estado);
    if (siTipoTrabajo) params.set("siTipoTrabajo", siTipoTrabajo);
    if (sector.trim()) params.set("sector", sector.trim());
    if (tecnicoId) params.set("tecnicoId", tecnicoId);
    try {
      const res = await fetch(`/api/soporte-infraestructura/ordenes?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setOrdenes(data.ordenes || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setOrdenes([]);
    } finally {
      setLoading(false);
    }
  }, [q, estado, siTipoTrabajo, sector, tecnicoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader
        title="Soporte de Infraestructura"
        subtitle="Órdenes de soporte sobre la red · códigos INF-*"
      />
      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <div className="flex flex-wrap gap-2 justify-between">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/supervisor/soporte-infraestructura/estadisticas"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-xl bg-white"
            >
              <BarChart3 className="w-4 h-4" /> Estadísticas
            </Link>
            <Link
              href="/supervisor"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-xl bg-white"
            >
              Panel supervisor
            </Link>
          </div>
          <Link
            href="/supervisor/tickets/nuevo-infraestructura"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-violet-700 text-white rounded-xl font-medium"
          >
            <Plus className="w-4 h-4" /> Nuevo Soporte
          </Link>
        </div>

        <p className="text-sm text-slate-600">
          Flujo igual al soporte a clientes: cree una <strong>orden de soporte</strong>, asigne
          técnicos y el reporte PDF se genera al finalizar.
        </p>

        {kpis && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard label="Pendientes" value={kpis.pendientes} color="slate" />
            <StatCard label="Asignadas" value={kpis.asignadas} color="blue" />
            <StatCard label="En proceso" value={kpis.enProceso} color="yellow" />
            <StatCard label="Finalizadas" value={kpis.finalizadas} color="green" />
            <StatCard label="Críticas (ALTA)" value={kpis.criticas} color="red" />
            <StatCard
              label="Tiempo prom."
              value={kpis.tiempoPromedioMin != null ? `${kpis.tiempoPromedioMin}m` : "—"}
              color="slate"
            />
            <StatCard label="Téc. disponibles" value={kpis.tecnicosDisponibles} color="green" />
            <StatCard label="Téc. en campo" value={kpis.tecnicosEnCampo} color="blue" />
          </div>
        )}

        <div className="bg-white rounded-xl border p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nº orden, sector…"
              className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm"
            />
          </div>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="w-full px-3 py-2 border rounded-xl text-sm"
          >
            <option value="">Todos los estados</option>
            {Object.entries(SI_ESTADO_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            value={siTipoTrabajo}
            onChange={(e) => setSiTipoTrabajo(e.target.value)}
            className="w-full px-3 py-2 border rounded-xl text-sm"
          >
            <option value="">Todos los tipos</option>
            {SI_TIPOS_TRABAJO.map((t) => (
              <option key={t} value={t}>
                {SI_TIPO_TRABAJO_LABELS[t]}
              </option>
            ))}
          </select>
          <input
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            placeholder="Sector"
            className="w-full px-3 py-2 border rounded-xl text-sm"
          />
          <select
            value={tecnicoId}
            onChange={(e) => setTecnicoId(e.target.value)}
            className="w-full px-3 py-2 border rounded-xl text-sm"
          >
            <option value="">Todos los técnicos</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl">{error}</div>
        )}

        <div className="bg-white rounded-xl border overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : ordenes.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-12">Sin órdenes</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Número</th>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Responsable</th>
                    <th className="px-3 py-2 hidden sm:table-cell">Técnicos</th>
                    <th className="px-3 py-2 hidden md:table-cell">Tipo</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenes.map((o) => (
                    <tr key={o.id} className="border-t">
                      <td className="px-3 py-2 font-medium text-violet-800">{o.codigo}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(o.fecha).toLocaleDateString("es-EC")}
                      </td>
                      <td className="px-3 py-2">{o.tecnicoResponsable}</td>
                      <td className="px-3 py-2 hidden sm:table-cell">{o.cantidadTecnicos}</td>
                      <td className="px-3 py-2 hidden md:table-cell">{o.tipoLabel}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100">
                          {o.estadoLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
