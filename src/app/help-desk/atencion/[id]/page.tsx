"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Loader2,
  Send,
  Wrench,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { fetchJson } from "@/lib/fetch-json-client";
import {
  HD_ACCION_LABELS,
  HD_MOTIVO_ESCALA_LABELS,
} from "@/lib/help-desk/labels";
import type { HdMotivoEscalamiento, HdTipoAccionRemota } from "@prisma/client";

type Mensaje = { id: string; autor: string; contenido: string; createdAt: string };
type Sugerencia = { tipo: string; titulo: string; contenido: string };

type ConversacionData = {
  conversacion: {
    id: string;
    codigo: string;
    estado: string;
    motivo: string | null;
    canal: string;
    mensajes: Mensaje[];
    acciones: { tipo: string; createdAt: string; exito: boolean }[];
    sugerencias: { contenido: string; metadataJson?: string | null }[];
    escalamiento: { motivo: string } | null;
    ticket: { codigo: string } | null;
  };
  contexto: {
    cliente: {
      nombre: string;
      telefono: string;
      plan: string;
      direccion: string;
      sector: string;
      onuSerial: string | null;
      potencia: number | null;
      cajaNap: string | null;
      activo: boolean;
      referencia: string | null;
    } | null;
    tipoCliente: string;
    estadoServicio: string;
    ticketsRecientes: { codigo: string; estado: string; motivo: string | null }[];
  };
};

const ACCIONES_RAPIDAS: HdTipoAccionRemota[] = [
  "SPEED_TEST",
  "DIAG_POTENCIA",
  "DIAG_ONU",
  "DIAG_DISPOSITIVOS",
  "ROUTER_REINICIO",
  "WIFI_PASSWORD",
  "PING",
];

export default function AtencionHelpDeskPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<ConversacionData | null>(null);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [showEscalar, setShowEscalar] = useState(false);
  const [motivoEscala, setMotivoEscala] = useState<HdMotivoEscalamiento>("OTRO");

  const load = useCallback(async () => {
    const { data: json } = await fetchJson<ConversacionData>(`/api/help-desk/conversaciones/${id}`);
    if (json) {
      setData(json);
      await fetchJson(`/api/help-desk/conversaciones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "EN_ATENCION" }),
      });
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  async function enviarMensaje(e: React.FormEvent) {
    e.preventDefault();
    if (!mensaje.trim()) return;
    setEnviando(true);
    const { data: res } = await fetchJson<{ mensaje: Mensaje; sugerencias: Sugerencia[] }>(
      `/api/help-desk/conversaciones/${id}/mensajes`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido: mensaje, autor: "AGENTE" }),
      }
    );
    setEnviando(false);
    if (res) {
      setMensaje("");
      setSugerencias(res.sugerencias ?? []);
      load();
    }
  }

  async function ejecutarAccion(tipo: HdTipoAccionRemota) {
    const configNueva = tipo === "WIFI_PASSWORD" ? prompt("Nueva contraseña WiFi:") : undefined;
    if (tipo === "WIFI_PASSWORD" && !configNueva) return;
    await fetchJson(`/api/help-desk/conversaciones/${id}/acciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, configNueva, motivo: "Atención remota N1" }),
    });
    load();
  }

  async function resolver() {
    await fetchJson(`/api/help-desk/conversaciones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "RESUELTO", satisfaccion: 5 }),
    });
    load();
  }

  async function escalar() {
    const { error } = await fetchJson(`/api/help-desk/conversaciones/${id}/escalar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: motivoEscala }),
    });
    if (error) alert(error);
    else {
      setShowEscalar(false);
      load();
    }
  }

  function usarSugerencia(s: Sugerencia) {
    setMensaje(s.contenido);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!data) {
    return <p className="p-6 text-red-600">Conversación no encontrada</p>;
  }

  const { conversacion, contexto } = data;
  const cliente = contexto.cliente;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100dvh-0px)] lg:h-dvh">
      {/* Panel cliente */}
      <aside className="lg:w-72 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 overflow-y-auto shrink-0">
        <Link href="/help-desk/cola" className="inline-flex items-center gap-1 text-sm text-teal-600 mb-3">
          <ArrowLeft className="w-4 h-4" /> Cola
        </Link>
        <p className="text-xs font-mono text-teal-600">{conversacion.codigo}</p>
        <h2 className="font-bold text-lg mt-1">{cliente?.nombre ?? "Prospecto"}</h2>
        <p className="text-sm text-slate-500">{cliente?.telefono ?? "—"}</p>
        <div className="mt-4 space-y-2 text-sm">
          <Row label="Tipo" value={contexto.tipoCliente} />
          <Row label="Plan" value={cliente?.plan ?? "—"} />
          <Row label="Sector" value={cliente?.sector ?? "—"} />
          <Row label="Dirección" value={cliente?.direccion ?? "—"} />
          <Row label="ONU" value={cliente?.onuSerial ?? "—"} />
          <Row label="Potencia" value={cliente?.potencia != null ? `${cliente.potencia} dBm` : "—"} />
          <Row label="NAP" value={cliente?.cajaNap ?? "—"} />
          <Row label="Servicio" value={contexto.estadoServicio} />
        </div>
        {contexto.ticketsRecientes.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase">Tickets recientes</p>
            <ul className="mt-1 space-y-1">
              {contexto.ticketsRecientes.map((t) => (
                <li key={t.codigo} className="text-xs">
                  <span className="font-mono">{t.codigo}</span> — {t.estado}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      {/* Chat */}
      <section className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950">
        <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <div>
            <p className="font-medium">{conversacion.motivo ?? "Atención remota"}</p>
            <p className="text-xs text-slate-500">{conversacion.estado} · {conversacion.canal}</p>
          </div>
          <div className="flex gap-2">
            {conversacion.estado !== "RESUELTO" && conversacion.estado !== "ESCALADO" && (
              <>
                <button
                  type="button"
                  onClick={resolver}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Resuelto
                </button>
                <button
                  type="button"
                  onClick={() => setShowEscalar(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs"
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> Escalar
                </button>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {conversacion.mensajes.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                m.autor === "CLIENTE"
                  ? "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  : m.autor === "SISTEMA"
                    ? "bg-slate-200 dark:bg-slate-800 text-xs text-slate-600 mx-auto"
                    : "bg-teal-600 text-white ml-auto"
              }`}
            >
              <p className="text-[10px] opacity-70 mb-0.5">{m.autor}</p>
              {m.contenido}
            </div>
          ))}
        </div>

        {conversacion.estado !== "RESUELTO" && conversacion.estado !== "ESCALADO" && (
          <form onSubmit={enviarMensaje} className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
            <input
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Escriba al cliente…"
              className="flex-1 px-4 py-2.5 rounded-xl border dark:bg-slate-900 dark:border-slate-700"
            />
            <button
              type="submit"
              disabled={enviando}
              className="px-4 py-2.5 rounded-xl bg-teal-600 text-white disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        )}

        {conversacion.ticket && (
          <p className="text-center text-sm text-amber-700 py-2 bg-amber-50 dark:bg-amber-950">
            Ticket escalado: {conversacion.ticket.codigo}
          </p>
        )}
      </section>

      {/* IA + acciones */}
      <aside className="lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 overflow-y-auto shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Bot className="w-5 h-5 text-violet-600" />
          <h3 className="font-semibold">Copiloto IA</h3>
        </div>
        <div className="space-y-2 mb-6">
          {sugerencias.length > 0
            ? sugerencias.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => usarSugerencia(s)}
                  className="w-full text-left p-2 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 text-xs hover:border-violet-400"
                >
                  <span className="font-semibold text-violet-700 dark:text-violet-300">{s.titulo}</span>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5">{s.contenido}</p>
                </button>
              ))
            : conversacion.sugerencias.map((s, i) => {
                let parsed: Sugerencia = { tipo: "accion", titulo: "Sugerencia", contenido: s.contenido };
                if ("metadataJson" in s && s.metadataJson) {
                  try {
                    parsed = JSON.parse(s.metadataJson as string);
                  } catch {
                    /* usar default */
                  }
                }
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => usarSugerencia(parsed)}
                    className="w-full text-left p-2 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 text-xs"
                  >
                    <span className="font-semibold text-violet-700 dark:text-violet-300">{parsed.titulo}</span>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5">{parsed.contenido}</p>
                  </button>
                );
              })}
          {sugerencias.length === 0 && conversacion.sugerencias.length === 0 && (
            <p className="text-xs text-slate-500">La IA sugerirá pasos al recibir mensajes del cliente.</p>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Wrench className="w-5 h-5 text-teal-600" />
          <h3 className="font-semibold">Acciones remotas</h3>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {ACCIONES_RAPIDAS.map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => ejecutarAccion(tipo)}
              disabled={conversacion.estado === "ESCALADO" || conversacion.estado === "RESUELTO"}
              className="text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs hover:bg-teal-50 dark:hover:bg-teal-950/30 disabled:opacity-40"
            >
              {HD_ACCION_LABELS[tipo]}
            </button>
          ))}
        </div>

        {conversacion.acciones.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500">Auditoría reciente</p>
            <ul className="mt-1 space-y-1">
              {conversacion.acciones.map((a, i) => (
                <li key={i} className="text-xs text-slate-500">
                  {HD_ACCION_LABELS[a.tipo as HdTipoAccionRemota] ?? a.tipo}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      {showEscalar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 max-w-md w-full space-y-4">
            <h3 className="font-bold">Escalar a técnico de campo</h3>
            <select
              value={motivoEscala}
              onChange={(e) => setMotivoEscala(e.target.value as HdMotivoEscalamiento)}
              className="w-full px-3 py-2 rounded-lg border dark:bg-slate-800"
            >
              {Object.entries(HD_MOTIVO_ESCALA_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowEscalar(false)} className="px-4 py-2 text-sm">
                Cancelar
              </button>
              <button
                type="button"
                onClick={escalar}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm"
              >
                Generar orden de trabajo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-400 text-xs">{label}</span>
      <p className="font-medium">{value}</p>
    </div>
  );
}
