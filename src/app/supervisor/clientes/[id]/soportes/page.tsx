"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileDown, Loader2, Search } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import {
  HistorialSoportesResumen,
  type ResumenSoportes,
} from "@/components/clientes/HistorialSoportesResumen";
import { ESTADO_LABELS, TIPO_LABELS, formatDateShort, formatDuration, formatTime } from "@/lib/utils";

type Item = {
  id: string;
  codigo: string;
  tipo: string;
  estado: string;
  motivo: string | null;
  createdAt: string;
  iniciadoEn: string | null;
  finalizadoEn: string | null;
  duracionSegundos: number;
  resultado: string;
  tecnicosLabel: string;
};

type ClienteMini = { id: string; nombre: string; plan: string };

export default function HistorialSoportesClientePage() {
  const params = useParams();
  const id = params.id as string;
  const [cliente, setCliente] = useState<ClienteMini | null>(null);
  const [resumen, setResumen] = useState<ResumenSoportes | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalFiltrado, setTotalFiltrado] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [motivo, setMotivo] = useState("");
  const [tecnico, setTecnico] = useState("");
  const [estado, setEstado] = useState("");
  const [tipo, setTipo] = useState("");
  const [rango, setRango] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [reincidencia, setReincidencia] = useState(false);

  function buildParams(p: number) {
    const paramsQs = new URLSearchParams();
    paramsQs.set("page", String(p));
    paramsQs.set("limit", "20");
    if (q.trim()) paramsQs.set("q", q.trim());
    if (motivo.trim()) paramsQs.set("motivo", motivo.trim());
    if (tecnico.trim()) paramsQs.set("tecnico", tecnico.trim());
    if (estado) paramsQs.set("estado", estado);
    if (tipo) paramsQs.set("tipo", tipo);
    if (rango) paramsQs.set("rango", rango);
    if (rango === "custom" && desde) paramsQs.set("desde", desde);
    if (rango === "custom" && hasta) paramsQs.set("hasta", hasta);
    if (reincidencia) paramsQs.set("reincidencia", "1");
    return paramsQs;
  }

  async function cargar(p = 1) {
    setLoading(true);
    setError("");
    const paramsQs = buildParams(p);
    try {
      const res = await fetch(`/api/clientes/${id}/soportes?${paramsQs}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo cargar el historial");
        setItems([]);
        return;
      }
      setCliente(data.cliente);
      setResumen(data.resumen);
      setItems(data.items ?? []);
      setPage(data.filtros?.page ?? p);
      setPages(data.pages ?? 1);
      setTotalFiltrado(data.totalFiltrado ?? 0);
    } catch {
      setError("Sin conexión");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar(1);
  }, [id]);

  function qsActual() {
    return buildParams(1).toString();
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Historial de soportes" subtitle={cliente?.nombre ?? "Cliente"} />
      <main className="max-w-6xl mx-auto p-4 space-y-4">
        <Link
          href={`/supervisor/clientes/${id}`}
          className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a la ficha
        </Link>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</div>}

        {resumen && cliente && (
          <HistorialSoportesResumen
            clienteNombre={cliente.nombre}
            plan={cliente.plan}
            resumen={resumen}
          />
        )}

        <section className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Historial de soportes</h2>
            <a
              href={`/api/clientes/${id}/soportes/pdf?${qsActual()}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-infinity-600 text-white text-sm font-medium hover:bg-infinity-700"
            >
              <FileDown className="w-4 h-4" /> Exportar historial PDF
            </a>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
            <label className="flex items-center gap-2 border rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ticket o problema"
                className="w-full outline-none"
              />
            </label>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Problema"
              className="border rounded-xl px-3 py-2"
            />
            <input
              value={tecnico}
              onChange={(e) => setTecnico(e.target.value)}
              placeholder="Técnico"
              className="border rounded-xl px-3 py-2"
            />
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="border rounded-xl px-3 py-2"
            >
              <option value="">Todos los estados</option>
              {Object.entries(ESTADO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="border rounded-xl px-3 py-2"
            >
              <option value="">Todos los tipos</option>
              {["SOPORTE", "INSTALACION", "MIGRACION", "RECONEXION", "RETIRO", "CORTE"].map((k) => (
                <option key={k} value={k}>
                  {TIPO_LABELS[k]}
                </option>
              ))}
            </select>
            <select
              value={rango}
              onChange={(e) => setRango(e.target.value)}
              className="border rounded-xl px-3 py-2"
            >
              <option value="">Todas las fechas</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
              <option value="90d">Últimos 90 días</option>
              <option value="anio">Este año</option>
              <option value="custom">Personalizado</option>
            </select>
            {rango === "custom" && (
              <>
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="border rounded-xl px-3 py-2"
                />
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="border rounded-xl px-3 py-2"
                />
              </>
            )}
            <label className="flex items-center gap-2 text-sm px-1">
              <input
                type="checkbox"
                checked={reincidencia}
                onChange={(e) => setReincidencia(e.target.checked)}
              />
              Solo reincidencias
            </label>
            <button
              type="button"
              onClick={() => void cargar(1)}
              className="px-3 py-2 rounded-xl bg-slate-800 text-white text-sm font-medium"
            >
              Aplicar filtros
            </button>
          </div>
          <p className="text-xs text-slate-500">{totalFiltrado} soportes en el filtro actual</p>
        </section>

        <section className="bg-white rounded-xl border overflow-hidden">
          {loading ? (
            <div className="p-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-infinity-600" />
            </div>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No hay soportes para este filtro.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Ticket</th>
                    <th className="p-3">Motivo</th>
                    <th className="p-3">Técnico</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Inicio</th>
                    <th className="p-3">Fin</th>
                    <th className="p-3">Tiempo</th>
                    <th className="p-3">Resultado</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3 whitespace-nowrap">{formatDateShort(item.createdAt)}</td>
                      <td className="p-3 font-medium">{item.codigo}</td>
                      <td className="p-3">{item.motivo || "—"}</td>
                      <td className="p-3">{item.tecnicosLabel}</td>
                      <td className="p-3">{ESTADO_LABELS[item.estado] ?? item.estado}</td>
                      <td className="p-3 whitespace-nowrap">
                        {item.iniciadoEn ? formatTime(item.iniciadoEn) : "—"}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {item.finalizadoEn ? formatTime(item.finalizadoEn) : "—"}
                      </td>
                      <td className="p-3">
                        {item.duracionSegundos > 0 ? formatDuration(item.duracionSegundos) : "—"}
                      </td>
                      <td className="p-3">{item.resultado}</td>
                      <td className="p-3">
                        <Link
                          href={`/supervisor/clientes/${id}/soportes/${item.id}`}
                          className="text-infinity-600 font-medium hover:underline"
                        >
                          Ver detalle
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => void cargar(page - 1)}
                className="px-3 py-1.5 rounded-lg border disabled:opacity-40"
              >
                Anterior
              </button>
              <span>
                Página {page} de {pages}
              </span>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => void cargar(page + 1)}
                className="px-3 py-1.5 rounded-lg border disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
