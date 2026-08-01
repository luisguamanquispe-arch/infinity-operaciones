"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Clock,
  Loader2,
  Network,
  Plus,
  Search,
  Users,
  Wrench,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import {
  IR_ESTADO_LABELS,
  IR_ESTADOS,
  IR_TIPO_TRABAJO_LABELS,
  IR_TIPOS_TRABAJO,
  formatoTiempoMinutos,
} from "@/lib/infraestructura-red/labels";

type Kpis = {
  abiertos: number;
  enProceso: number;
  finalizados: number;
  preventivos: number;
  correctivos: number;
  kmRed: number;
  clientesAfectados: number;
  tiempoPromedioMin: number | null;
};

type ReporteRow = {
  id: string;
  codigo: string;
  fecha: string;
  estado: keyof typeof IR_ESTADO_LABELS;
  tipoTrabajo: keyof typeof IR_TIPO_TRABAJO_LABELS;
  sector: string;
  tecnico: { usuario: { nombre: string } };
};

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-3 sm:p-4">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className="text-xl sm:text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
        {value}
      </p>
      {hint ? <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p> : null}
    </div>
  );
}

export default function InfraestructuraListPage() {
  const [reportes, setReportes] = useState<ReporteRow[]>([]);
  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string }[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [tipoTrabajo, setTipoTrabajo] = useState("");
  const [sector, setSector] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [desde, setDesde] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/infraestructura/catalogo")
      .then((r) => r.json())
      .then((d) => setTecnicos(d.tecnicos || []))
      .catch(() => {});
    void fetch("/api/infraestructura/kpis")
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
    if (tipoTrabajo) params.set("tipoTrabajo", tipoTrabajo);
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
  }, [q, estado, tipoTrabajo, sector, tecnicoId, desde]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader
        title="Infraestructura de Red"
        subtitle="Trabajos sobre la red de fibra óptica · no soporte a cliente"
      />

      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Network className="w-4 h-4 text-cyan-700" />
            Administración de intervenciones físicas en red
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/infraestructura/estadisticas"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-xl bg-white hover:bg-slate-50"
            >
              <BarChart3 className="w-4 h-4" /> Estadísticas
            </Link>
            <Link
              href="/infraestructura/nuevo"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl font-medium"
            >
              <Plus className="w-4 h-4" /> Nuevo reporte
            </Link>
          </div>
        </div>

        {kpis && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <KpiCard label="Abiertos" value={kpis.abiertos} hint="Pendiente + Asignado" />
            <KpiCard label="En proceso" value={kpis.enProceso} />
            <KpiCard label="Finalizados" value={kpis.finalizados} />
            <KpiCard
              label="Tiempo prom. reparación"
              value={formatoTiempoMinutos(kpis.tiempoPromedioMin)}
            />
            <KpiCard label="Preventivos" value={kpis.preventivos} />
            <KpiCard label="Correctivos" value={kpis.correctivos} />
            <KpiCard label="Km intervenidos" value={kpis.kmRed.toFixed(2)} />
            <KpiCard label="Clientes afectados" value={kpis.clientesAfectados} />
          </div>
        )}

        <div className="bg-white rounded-xl border p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nº reporte, sector…"
                className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm"
              />
            </div>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm"
            >
              <option value="">Todos los estados</option>
              {IR_ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {IR_ESTADO_LABELS[e]}
                </option>
              ))}
            </select>
            <select
              value={tipoTrabajo}
              onChange={(e) => setTipoTrabajo(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm"
            >
              <option value="">Todos los tipos</option>
              {IR_TIPOS_TRABAJO.map((t) => (
                <option key={t} value={t}>
                  {IR_TIPO_TRABAJO_LABELS[t]}
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
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl">{error}</div>
        )}

        <div className="bg-white rounded-xl border overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : reportes.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              No hay reportes con esos filtros
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nº reporte</th>
                    <th className="px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 font-medium">Técnico</th>
                    <th className="px-3 py-2 font-medium hidden sm:table-cell">Tipo</th>
                    <th className="px-3 py-2 font-medium">Sector</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {reportes.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-slate-50/80">
                      <td className="px-3 py-2 font-medium text-cyan-800">{r.codigo}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(r.fecha).toLocaleDateString("es-EC")}
                      </td>
                      <td className="px-3 py-2">{r.tecnico.usuario.nombre}</td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        {IR_TIPO_TRABAJO_LABELS[r.tipoTrabajo]}
                      </td>
                      <td className="px-3 py-2">{r.sector}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-slate-100">
                          {IR_ESTADO_LABELS[r.estado]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/infraestructura/${r.id}`}
                          className="text-cyan-700 hover:underline font-medium"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 flex flex-wrap gap-3 items-center">
          <span className="inline-flex items-center gap-1">
            <Wrench className="w-3 h-3" /> Trabajos de red física
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="w-3 h-3" /> Clientes afectados opcionales
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> Tiempo automático por horas
          </span>
        </p>
      </main>
    </div>
  );
}
