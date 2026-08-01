"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Headphones, Loader2, Plus, Search } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import {
  SR_ESTADO_LABELS,
  SR_ESTADOS,
  SR_TIPO_SOPORTE_LABELS,
  SR_TIPOS_SOPORTE,
  formatTiempoMinutos,
} from "@/lib/soporte-remoto/labels";

type TicketRow = {
  id: string;
  codigo: string;
  fecha: string;
  estado: keyof typeof SR_ESTADO_LABELS;
  tipoSoporte: keyof typeof SR_TIPO_SOPORTE_LABELS;
  clienteNombre: string;
  tiempoMinutos: number | null;
  operador: { nombre: string };
};

type Operador = { id: string; nombre: string };

export default function SoporteRemotoListPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [operadorId, setOperadorId] = useState("");
  const [tipoSoporte, setTipoSoporte] = useState("");
  const [desde, setDesde] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/soporte-remoto/catalogo")
      .then((r) => r.json())
      .then((d) => setOperadores(d.operadores || []))
      .catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ take: "80" });
    if (q.trim()) params.set("q", q.trim());
    if (estado) params.set("estado", estado);
    if (operadorId) params.set("operadorId", operadorId);
    if (tipoSoporte) params.set("tipoSoporte", tipoSoporte);
    if (desde) params.set("desde", new Date(desde).toISOString());
    try {
      const res = await fetch(`/api/soporte-remoto/tickets?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      setTickets(data.tickets || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [q, estado, operadorId, tipoSoporte, desde]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader
        title="Soporte Remoto"
        subtitle="Asistencias desde oficina — sin visita al domicilio"
      />

      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Módulo independiente del soporte técnico presencial (tickets ST-*).
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/soporte-remoto/estadisticas"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-white"
            >
              <BarChart3 className="w-4 h-4" /> Estadísticas
            </Link>
            <Link
              href="/soporte-remoto/nuevo"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Nuevo ticket
            </Link>
          </div>
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
              placeholder="Cliente, código, teléfono…"
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
            value={operadorId}
            onChange={(e) => setOperadorId(e.target.value)}
            className="px-3 py-2.5 border rounded-xl text-sm"
          >
            <option value="">Todos los operadores</option>
            {operadores.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
          <select
            value={tipoSoporte}
            onChange={(e) => setTipoSoporte(e.target.value)}
            className="px-3 py-2.5 border rounded-xl text-sm"
          >
            <option value="">Todos los tipos</option>
            {SR_TIPOS_SOPORTE.map((t) => (
              <option key={t} value={t}>
                {SR_TIPO_SOPORTE_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="px-3 py-2.5 border rounded-xl text-sm"
          >
            <option value="">Todos los estados</option>
            {SR_ESTADOS.map((e) => (
              <option key={e} value={e}>
                {SR_ESTADO_LABELS[e]}
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
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Headphones className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>No hay tickets con esos filtros.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left p-3 font-medium">Ticket</th>
                    <th className="text-left p-3 font-medium">Fecha</th>
                    <th className="text-left p-3 font-medium">Cliente</th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">Operador</th>
                    <th className="text-left p-3 font-medium hidden lg:table-cell">Tipo</th>
                    <th className="text-left p-3 font-medium">Tiempo</th>
                    <th className="text-left p-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} className="border-t hover:bg-slate-50">
                      <td className="p-3">
                        <Link
                          href={`/soporte-remoto/${t.id}`}
                          className="font-semibold text-teal-700 hover:underline"
                        >
                          {t.codigo}
                        </Link>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {new Date(t.fecha).toLocaleDateString("es-EC")}
                      </td>
                      <td className="p-3">{t.clienteNombre}</td>
                      <td className="p-3 hidden md:table-cell">{t.operador.nombre}</td>
                      <td className="p-3 hidden lg:table-cell">
                        {SR_TIPO_SOPORTE_LABELS[t.tipoSoporte]}
                      </td>
                      <td className="p-3">{formatTiempoMinutos(t.tiempoMinutos)}</td>
                      <td className="p-3">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            t.estado === "FINALIZADO"
                              ? "bg-emerald-100 text-emerald-800"
                              : t.estado === "EN_PROCESO"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {SR_ESTADO_LABELS[t.estado]}
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
