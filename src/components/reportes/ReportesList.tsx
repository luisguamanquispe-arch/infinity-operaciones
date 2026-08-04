"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Loader2,
  FileText,
  Camera,
  PenLine,
  Gauge,
  Filter,
  Search,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { StatCard } from "@/components/StatCard";
import { FirmaMiniatura } from "./FirmaMiniatura";
import { DescargarPdfCliente } from "./DescargarPdfCliente";
import {
  TIPO_LABELS,
  ESTADO_LABELS,
  formatDateShort,
} from "@/lib/utils";
import { ESTADO_REVISION_LABELS } from "@/lib/revision-reporte";
import { fetchJson } from "@/lib/fetch-json-client";
import type { EstadoRevision } from "@prisma/client";

interface ReporteItem {
  id: string;
  codigo: string;
  tipo: string;
  modalidadSoporte?: string | null;
  estado: string;
  estadoRevision?: string | null;
  motivo: string | null;
  cerradoEn: string;
  cliente: { nombre: string; cedula: string; sector: string };
  tecnico: string;
  duracionMin: number | null;
  totalFotos: number;
  tieneFirma: boolean;
  firmaSrc: string | null;
  tieneMedicion: boolean;
  totalMateriales: number;
}

interface ReportesData {
  resumen: {
    total: number;
    conFotos: number;
    conFirma: number;
    conMedicion: number;
    tiempoPromedioMin: number;
    paginaActual?: number;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  items: ReporteItem[];
  filtros: {
    tecnicos: { id: string; nombre: string }[];
    sectores: string[];
  };
}

interface ReportesListProps {
  backHref: string;
  backLabel: string;
  title?: string;
}

export function ReportesList({
  backHref,
  backLabel,
  title = "Reportes de órdenes finalizadas",
}: ReportesListProps) {
  const [data, setData] = useState<ReportesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [filtros, setFiltros] = useState({
    desde: "",
    hasta: "",
    tecnicoId: "",
    tipo: "",
    sector: "",
    q: "",
    revision: "all",
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    params.set("page", String(page));
    params.set("limit", "100");
    const { data: json, error: err } = await fetchJson<ReportesData>(
      `/api/reportes?${params}`
    );
    if (err || !json || !Array.isArray(json.items)) {
      setData(null);
      setError(err || "No se pudieron cargar los reportes");
    } else {
      setData(json);
    }
    setLoading(false);
  }, [filtros, page]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function handleFilterChange(key: string, value: string) {
    setPage(1);
    setFiltros((prev) => ({ ...prev, [key]: value }));
  }

  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title={title} subtitle="Evidencia fotográfica y cierre" />

      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <Link href={backHref} className="text-sm text-infinity-600 hover:underline">
          ← {backLabel}
        </Link>

        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Total finalizadas" value={data.resumen.total} icon={FileText} color="blue" />
            <StatCard label="Con fotos (página)" value={data.resumen.conFotos} icon={Camera} color="green" />
            <StatCard label="Con firma (página)" value={data.resumen.conFirma} icon={PenLine} color="slate" />
            <StatCard label="Con medición (página)" value={data.resumen.conMedicion} icon={Gauge} color="yellow" />
            <StatCard
              label="Tiempo prom. (página)"
              value={`${data.resumen.tiempoPromedioMin}m`}
              color="slate"
            />
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <div>
              <label className="text-xs text-slate-500">Revisión</label>
              <select
                value={filtros.revision}
                onChange={(e) => handleFilterChange("revision", e.target.value)}
                className="w-full px-2 py-1.5 border rounded-lg text-sm mt-0.5"
              >
                <option value="all">Todos</option>
                <option value="cola">Cola (pendiente / corregido)</option>
                <option value="pendiente">Pendiente de revisión</option>
                <option value="corregido">Corregidos</option>
                <option value="aprobados">Aprobados</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Desde</label>
              <input
                type="date"
                value={filtros.desde}
                onChange={(e) => handleFilterChange("desde", e.target.value)}
                className="w-full px-2 py-1.5 border rounded-lg text-sm mt-0.5"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Hasta</label>
              <input
                type="date"
                value={filtros.hasta}
                onChange={(e) => handleFilterChange("hasta", e.target.value)}
                className="w-full px-2 py-1.5 border rounded-lg text-sm mt-0.5"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Técnico</label>
              <select
                value={filtros.tecnicoId}
                onChange={(e) => handleFilterChange("tecnicoId", e.target.value)}
                className="w-full px-2 py-1.5 border rounded-lg text-sm mt-0.5"
              >
                <option value="">Todos</option>
                {data?.filtros.tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Tipo</label>
              <select
                value={filtros.tipo}
                onChange={(e) => handleFilterChange("tipo", e.target.value)}
                className="w-full px-2 py-1.5 border rounded-lg text-sm mt-0.5"
              >
                <option value="">Todos</option>
                {Object.entries(TIPO_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Sector</label>
              <select
                value={filtros.sector}
                onChange={(e) => handleFilterChange("sector", e.target.value)}
                className="w-full px-2 py-1.5 border rounded-lg text-sm mt-0.5"
              >
                <option value="">Todos</option>
                {data?.filtros.sectores.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Buscar</label>
              <div className="relative mt-0.5">
                <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ticket, cliente..."
                  value={filtros.q}
                  onChange={(e) => handleFilterChange("q", e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 border rounded-lg text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">{error}</p>
            <button
              type="button"
              onClick={() => cargar()}
              className="text-sm font-medium text-infinity-600 hover:underline shrink-0"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Tabla */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3">Ticket</th>
                    <th className="text-left p-3">Cliente</th>
                    <th className="text-left p-3 hidden sm:table-cell">Técnicos</th>
                    <th className="text-left p-3 hidden md:table-cell">Tipo</th>
                    <th className="text-left p-3">Cerrado</th>
                    <th className="text-left p-3">Firma</th>
                    <th className="text-left p-3">Evidencia</th>
                    <th className="text-left p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {!data?.items.length ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No hay órdenes finalizadas con estos filtros
                      </td>
                    </tr>
                  ) : (
                    data.items.map((item) => (
                      <tr key={item.id} className="border-t hover:bg-slate-50">
                        <td className="p-3">
                          <span className="font-semibold text-infinity-600">{item.codigo}</span>
                          <p className="text-xs text-slate-400">{ESTADO_LABELS[item.estado]}</p>
                          {item.estadoRevision && (
                            <p
                              className={`text-[11px] font-medium mt-0.5 ${
                                item.estadoRevision === "CORREGIDO"
                                  ? "text-sky-700"
                                  : item.estadoRevision === "PENDIENTE_REVISION"
                                    ? "text-amber-700"
                                    : item.estadoRevision === "APROBADO"
                                      ? "text-emerald-700"
                                      : "text-slate-500"
                              }`}
                            >
                              {ESTADO_REVISION_LABELS[
                                item.estadoRevision as EstadoRevision
                              ] || item.estadoRevision}
                            </p>
                          )}
                        </td>
                        <td className="p-3">
                          <p className="font-medium">{item.cliente.nombre}</p>
                          <p className="text-xs text-slate-400">{item.cliente.sector}</p>
                        </td>
                        <td className="p-3 hidden sm:table-cell text-xs leading-snug">{item.tecnico}</td>
                        <td className="p-3 hidden md:table-cell">
                          {TIPO_LABELS[item.tipo]}
                          {item.modalidadSoporte === "EXPRESS" && (
                            <span className="ml-1 text-xs font-semibold text-amber-700">
                              Express
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <p className="text-xs">{formatDateShort(item.cerradoEn)}</p>
                          {item.duracionMin != null && (
                            <p className="text-xs text-slate-400">{item.duracionMin} min</p>
                          )}
                        </td>
                        <td className="p-3">
                          <FirmaMiniatura
                            src={item.firmaSrc}
                            nombre={item.cliente.nombre}
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1 flex-wrap">
                            {item.totalFotos > 0 && (
                              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">
                                📷 {item.totalFotos}
                              </span>
                            )}
                            {item.tieneMedicion && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                                📊
                              </span>
                            )}
                            {item.totalMateriales > 0 && (
                              <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-xs">
                                📦 {item.totalMateriales}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                            <Link
                              href={`/reportes/${item.id}`}
                              className="text-xs font-medium text-infinity-600 hover:underline whitespace-nowrap"
                            >
                              Ver reporte →
                            </Link>
                            <DescargarPdfCliente
                              ticketId={item.id}
                              codigo={item.codigo}
                              variant="link"
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {pagination && data.resumen.total > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 bg-slate-50">
                <p className="text-sm text-slate-600">
                  Mostrando{" "}
                  <span className="font-medium">
                    {(page - 1) * (pagination.limit) + 1}–
                    {Math.min(page * pagination.limit, pagination.total)}
                  </span>{" "}
                  de <span className="font-semibold">{pagination.total}</span> órdenes finalizadas
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border text-sm font-medium disabled:opacity-40 hover:bg-white"
                  >
                    ← Anterior
                  </button>
                  <span className="text-sm text-slate-500 tabular-nums">
                    Página {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={!pagination.hasMore || loading}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 rounded-lg border text-sm font-medium disabled:opacity-40 hover:bg-white"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
