"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json-client";
import { HD_CANAL_LABELS, HD_ESTADO_LABELS } from "@/lib/help-desk/labels";

type Conversacion = {
  id: string;
  codigo: string;
  estado: keyof typeof HD_ESTADO_LABELS;
  canal: keyof typeof HD_CANAL_LABELS;
  motivo: string | null;
  createdAt: string;
  cliente: { nombre: string; telefono: string; plan: string; sector: string } | null;
  prospectoNombre: string | null;
  prospectoTelefono: string | null;
  asignadoA: { nombre: string } | null;
  mensajes: { contenido: string }[];
};

export default function ColaHelpDeskPage() {
  const [items, setItems] = useState<Conversacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [showNueva, setShowNueva] = useState(false);
  const [form, setForm] = useState({ telefono: "", nombre: "", motivo: "", mensajeInicial: "" });
  const [creando, setCreando] = useState(false);

  async function load() {
    const url =
      filtro === "todos" ? "/api/help-desk/conversaciones" : `/api/help-desk/conversaciones?estado=${filtro}`;
    const { data } = await fetchJson<{ items: Conversacion[] }>(url);
    if (data?.items) setItems(data.items);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [filtro]);

  async function crearConversacion(e: React.FormEvent) {
    e.preventDefault();
    setCreando(true);
    const { data, error } = await fetchJson<{ conversacion: Conversacion }>("/api/help-desk/conversaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, canal: "CHAT" }),
    });
    setCreando(false);
    if (data?.conversacion) {
      setShowNueva(false);
      setForm({ telefono: "", nombre: "", motivo: "", mensajeInicial: "" });
      window.location.href = `/help-desk/atencion/${data.conversacion.id}`;
    } else {
      alert(error || "Error al crear");
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Cola de atención</h1>
          <p className="text-sm text-slate-500">WhatsApp, chat y llamadas entrantes</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowNueva(true)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nueva atención
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {["todos", "EN_COLA", "EN_ATENCION", "RESUELTO", "ESCALADO"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              filtro === f
                ? "bg-teal-600 text-white border-teal-600"
                : "border-slate-200 dark:border-slate-700"
            }`}
          >
            {f === "todos" ? "Todos" : HD_ESTADO_LABELS[f as keyof typeof HD_ESTADO_LABELS]}
          </button>
        ))}
      </div>

      {showNueva && (
        <form
          onSubmit={crearConversacion}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3"
        >
          <h2 className="font-semibold">Nueva conversación (chat web)</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              placeholder="Teléfono cliente"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              className="px-3 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-600"
            />
            <input
              placeholder="Nombre (opcional)"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="px-3 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-600"
            />
          </div>
          <input
            placeholder="Motivo"
            value={form.motivo}
            onChange={(e) => setForm({ ...form, motivo: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-600"
          />
          <textarea
            placeholder="Mensaje inicial del cliente"
            value={form.mensajeInicial}
            onChange={(e) => setForm({ ...form, mensajeInicial: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-600 min-h-[80px]"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={creando} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm">
              {creando ? "Creando…" : "Iniciar atención"}
            </button>
            <button type="button" onClick={() => setShowNueva(false)} className="px-4 py-2 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-slate-500 py-12">No hay conversaciones en esta cola.</p>
      ) : (
        <div className="space-y-2">
          {items.map((c) => {
            const nombre = c.cliente?.nombre ?? c.prospectoNombre ?? "Cliente sin identificar";
            const tel = c.cliente?.telefono ?? c.prospectoTelefono ?? "—";
            const ultimo = c.mensajes[0]?.contenido;
            return (
              <Link
                key={c.id}
                href={`/help-desk/atencion/${c.id}`}
                className="block rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 hover:border-teal-500 transition"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono text-teal-600">{c.codigo}</span>
                    <h3 className="font-semibold">{nombre}</h3>
                    <p className="text-sm text-slate-500">{tel} · {HD_CANAL_LABELS[c.canal]}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
                    {HD_ESTADO_LABELS[c.estado]}
                  </span>
                </div>
                {ultimo && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">{ultimo}</p>
                )}
                {c.asignadoA && (
                  <p className="text-xs text-slate-400 mt-1">Agente: {c.asignadoA.nombre}</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
