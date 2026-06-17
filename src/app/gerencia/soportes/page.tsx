"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Search, Trash2, AlertTriangle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { GerenciaQuickNav } from "@/components/DeployVersionBanner";
import {
  ESTADO_LABELS,
  PRIORIDAD_LABELS,
  TIPO_LABELS,
  formatDateTime,
} from "@/lib/utils";

interface SoporteItem {
  id: string;
  codigo: string;
  tipo: string;
  estado: string;
  prioridad: string;
  motivo: string | null;
  createdAt: string;
  programadoEn: string | null;
  cliente: { nombre: string; cedula: string; sector: string };
  tecnicosLabel: string;
  totalMateriales: number;
  totalFotos: number;
}

const ESTADOS_FILTRO = [
  { id: "activos", label: "Activos (pendiente / en proceso)" },
  { id: "todos", label: "Todos los estados" },
  { id: "PENDIENTE", label: "Pendientes" },
  { id: "EN_PROCESO", label: "En proceso" },
  { id: "FINALIZADO", label: "Finalizados" },
  { id: "CERRADO", label: "Cerrados" },
  { id: "CANCELADO", label: "Cancelados" },
];

export default function GerenciaSoportesPage() {
  const [items, setItems] = useState<SoporteItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("activos");
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<SoporteItem | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    params.set("estado", estado);

    try {
      const res = await fetch(`/api/gerencia/soportes?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudieron cargar los soportes");
        setItems([]);
        setTotal(0);
        return;
      }
      setItems(data.items ?? []);
      setTotal(data.total ?? data.items?.length ?? 0);
    } catch {
      setError("Sin conexión");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [q, estado]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function eliminarSoporte() {
    if (!confirmar) return;
    setEliminandoId(confirmar.id);
    setError("");

    try {
      const res = await fetch(`/api/tickets/${confirmar.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo eliminar el soporte");
        return;
      }
      setConfirmar(null);
      await cargar();
    } catch {
      setError("Sin conexión al eliminar");
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Soportes" subtitle="Eliminar tickets operativos (ST-*)" />

      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <GerenciaQuickNav />

        <Link
          href="/gerencia"
          className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a gerencia
        </Link>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-sm text-amber-950">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
          <p>
            Se listan todos los tickets operativos con código ST-* (soporte, instalación,
            reconexión, etc.). Por defecto se muestran los activos. Busque por código exacto
            (ej. ST-1002) si no aparece en la lista. Los tickets de infraestructura (INF-*)
            no se eliminan desde aquí.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              placeholder="Buscar por código (ST-1002), cliente, cédula o motivo…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm bg-white"
            />
          </div>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="px-3 py-2.5 border rounded-xl text-sm bg-white sm:w-56"
          >
            {ESTADOS_FILTRO.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {!loading && (
          <p className="text-sm text-slate-600">
            {total === 0
              ? "Sin resultados con los filtros actuales"
              : `${total} ticket${total === 1 ? "" : "s"} encontrado${total === 1 ? "" : "s"}`}
          </p>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left p-3 font-medium">Ticket</th>
                    <th className="text-left p-3 font-medium hidden sm:table-cell">Tipo</th>
                    <th className="text-left p-3 font-medium">Cliente</th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">Técnicos</th>
                    <th className="text-left p-3 font-medium">Estado</th>
                    <th className="text-left p-3 font-medium hidden lg:table-cell">Creado</th>
                    <th className="text-right p-3 font-medium w-28">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No hay tickets con estos filtros. Pruebe &quot;Todos los estados&quot; o
                        busque el código exacto.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="border-t hover:bg-slate-50/50">
                        <td className="p-3">
                          <span className="font-semibold text-infinity-600">{item.codigo}</span>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {item.motivo || "Sin motivo"}
                          </p>
                          <p className="text-xs text-slate-400 sm:hidden">
                            {TIPO_LABELS[item.tipo] ?? item.tipo}
                          </p>
                          <p className="text-xs text-slate-400 lg:hidden">
                            {formatDateTime(item.createdAt)}
                          </p>
                        </td>
                        <td className="p-3 hidden sm:table-cell text-slate-600">
                          {TIPO_LABELS[item.tipo] ?? item.tipo}
                        </td>
                        <td className="p-3">
                          <p className="font-medium">{item.cliente.nombre}</p>
                          <p className="text-xs text-slate-500">{item.cliente.sector}</p>
                        </td>
                        <td className="p-3 hidden md:table-cell text-slate-600">
                          {item.tecnicosLabel}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {ESTADO_LABELS[item.estado]}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {PRIORIDAD_LABELS[item.prioridad]}
                          </p>
                        </td>
                        <td className="p-3 hidden lg:table-cell text-slate-600 text-xs">
                          {formatDateTime(item.createdAt)}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => setConfirmar(item)}
                            disabled={eliminandoId === item.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-semibold text-lg text-slate-900">Eliminar ticket</h3>
            <p className="text-sm text-slate-600">
              ¿Confirma eliminar{" "}
              <strong className="font-mono text-infinity-700">{confirmar.codigo}</strong> (
              {TIPO_LABELS[confirmar.tipo] ?? confirmar.tipo}) de{" "}
              <strong>{confirmar.cliente.nombre}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmar(null)}
                disabled={!!eliminandoId}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void eliminarSoporte()}
                disabled={!!eliminandoId}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {eliminandoId ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
