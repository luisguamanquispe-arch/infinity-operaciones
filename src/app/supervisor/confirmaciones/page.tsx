"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Send,
  PhoneCall,
  ShieldCheck,
  CalendarClock,
  RefreshCw,
  Check,
  Ban,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmacionVisitaBadge } from "@/components/ConfirmacionVisitaBadge";
import { formatDateTime, TIPO_LABELS } from "@/lib/utils";
import type { ConfirmacionVisitaView } from "@/lib/confirmacion-visita/reglas";

interface ConfirmacionItem {
  id: string;
  codigo: string;
  tipo: string;
  prioridad: string;
  estadoTicket: string;
  programadoEn: string | null;
  esHoy: boolean;
  permiteExencion: boolean;
  cliente: { nombre: string; sector: string; telefono: string };
  tecnicosLabel: string;
  confirmacionVisita: ConfirmacionVisitaView;
  urlConfirmacion: string | null;
  mensajeSugerido: string | null;
}

interface ConfirmacionesResponse {
  whatsappConfigurado: boolean;
  fechaLocalEcuador: string;
  kpis: {
    pendientes: number;
    confirmadosHoy: number;
    reprogramacion: number;
    noDisponibles: number;
    sinRespuesta: number;
    canceladasInvalidadas: number;
    exentos: number;
  };
  items: ConfirmacionItem[];
}

const FILTROS = [
  { id: "TODOS", label: "Todos" },
  { id: "PENDIENTE_CONFIRMACION", label: "Pendientes de confirmación" },
  { id: "CONFIRMADO_HOY", label: "Confirmados para hoy" },
  { id: "SOLICITA_REPROGRAMACION", label: "Solicitudes de reprogramación" },
  { id: "NO_DISPONIBLE", label: "Clientes no disponibles" },
  { id: "SIN_RESPUESTA", label: "Sin respuesta" },
  { id: "CANCELADO", label: "Canceladas / invalidadas" },
  { id: "EXENTO", label: "Sin presencia requerida" },
] as const;

export default function SupervisorConfirmacionesPage() {
  const [filtro, setFiltro] = useState<string>("TODOS");
  const [data, setData] = useState<ConfirmacionesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);

  const [manualModal, setManualModal] = useState<ConfirmacionItem | null>(null);
  const [personaRecibe, setPersonaRecibe] = useState("");
  const [notaManual, setNotaManual] = useState("");

  const [exentoModal, setExentoModal] = useState<ConfirmacionItem | null>(null);
  const [motivoExento, setMotivoExento] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/supervisor/confirmaciones?filtro=${encodeURIComponent(filtro)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function copiarTexto(id: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoId(id);
      setTimeout(() => setCopiadoId(null), 2000);
    } catch {
      setFeedback({ tipo: "err", texto: "No se pudo copiar al portapapeles." });
    }
  }

  async function reenviar(item: ConfirmacionItem) {
    setBusyId(item.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/tickets/${item.id}/confirmacion-visita`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "reenviar" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ tipo: "err", texto: json.error || "No se pudo generar/reenviar." });
      } else {
        const msg =
          json.envio?.deliveryStatus === "SENT"
            ? `Solicitud enviada por WhatsApp para ${item.codigo}.`
            : `Enlace generado para ${item.codigo}. WhatsApp automático no configurado; copie el mensaje y compártalo al cliente.`;
        setFeedback({ tipo: "ok", texto: msg });
        if (json.mensajeTexto) {
          await navigator.clipboard.writeText(json.mensajeTexto).catch(() => {});
        }
        await cargar();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function guardarConfirmacionManual() {
    if (!manualModal) return;
    setBusyId(manualModal.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/tickets/${manualModal.id}/confirmacion-visita`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "confirmar_manual",
          personaRecibe,
          nota: notaManual,
          programadoEnEsperado: manualModal.programadoEn,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ tipo: "err", texto: json.error || "Error al confirmar." });
      } else {
        setFeedback({
          tipo: "ok",
          texto: `Confirmación telefónica auditada para ${manualModal.codigo}.`,
        });
        setManualModal(null);
        setPersonaRecibe("");
        setNotaManual("");
        await cargar();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function guardarExento() {
    if (!exentoModal) return;
    setBusyId(exentoModal.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/tickets/${exentoModal.id}/confirmacion-visita`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "marcar_exento",
          motivo: motivoExento,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ tipo: "err", texto: json.error || "No se pudo marcar como exento." });
      } else {
        setFeedback({
          tipo: "ok",
          texto: `Ticket ${exentoModal.codigo} marcado como sin presencia requerida (auditado).`,
        });
        setExentoModal(null);
        setMotivoExento("");
        await cargar();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function accionSimple(item: ConfirmacionItem, accion: "marcar_sin_respuesta" | "cancelar") {
    setBusyId(item.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/tickets/${item.id}/confirmacion-visita`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ tipo: "err", texto: json.error || "No se pudo actualizar el estado." });
      } else {
        setFeedback({
          tipo: "ok",
          texto:
            accion === "cancelar"
              ? `Confirmación cancelada para ${item.codigo} y técnico notificado.`
              : `Ticket ${item.codigo} marcado como Sin respuesta.`,
        });
        await cargar();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader
        title="Confirmaciones de visita"
        subtitle="Disponibilidad del cliente antes del desplazamiento"
      />

      <main className="max-w-6xl mx-auto p-4 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/supervisor"
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-infinity-700"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al panel Supervisor
          </Link>
          <button
            type="button"
            onClick={() => void cargar()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </button>
        </div>

        {data && !data.whatsappConfigurado && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
            <strong>WhatsApp automático no configurado en este entorno:</strong> puede generar y
            copiar el enlace seguro junto con el mensaje listo para enviar al cliente manualmente.
          </div>
        )}

        {feedback && (
          <div
            className={`rounded-xl border p-3 text-sm ${
              feedback.tipo === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            {feedback.texto}
          </div>
        )}

        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-xl border p-3">
              <p className="text-[11px] text-slate-500">Pendientes</p>
              <p className="text-2xl font-bold text-amber-700">{data.kpis.pendientes}</p>
            </div>
            <div className="bg-white rounded-xl border p-3">
              <p className="text-[11px] text-slate-500">Confirmados hoy</p>
              <p className="text-2xl font-bold text-emerald-700">{data.kpis.confirmadosHoy}</p>
            </div>
            <div className="bg-white rounded-xl border p-3">
              <p className="text-[11px] text-slate-500">Reprogramación</p>
              <p className="text-2xl font-bold text-orange-700">{data.kpis.reprogramacion}</p>
            </div>
            <div className="bg-white rounded-xl border p-3">
              <p className="text-[11px] text-slate-500">No disponibles</p>
              <p className="text-2xl font-bold text-red-700">{data.kpis.noDisponibles}</p>
            </div>
            <div className="bg-white rounded-xl border p-3">
              <p className="text-[11px] text-slate-500">Sin respuesta</p>
              <p className="text-2xl font-bold text-rose-700">{data.kpis.sinRespuesta}</p>
            </div>
            <div className="bg-white rounded-xl border p-3">
              <p className="text-[11px] text-slate-500">Canceladas / inv.</p>
              <p className="text-2xl font-bold text-slate-700">
                {data.kpis.canceladasInvalidadas}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                filtro === f.id
                  ? "bg-infinity-600 text-white border-infinity-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[60rem]">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="text-left p-3">Ticket / Programado</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Técnicos</th>
                  <th className="text-left p-3">Confirmación</th>
                  <th className="text-left p-3">Detalle respuesta</th>
                  <th className="text-right p-3">Gestión</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
                      Cargando confirmaciones…
                    </td>
                  </tr>
                ) : !data?.items.length ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
                      No hay tickets en este filtro.
                    </td>
                  </tr>
                ) : (
                  data.items.map((item) => {
                    const c = item.confirmacionVisita;
                    const busy = busyId === item.id;
                    return (
                      <tr key={item.id} className="border-t align-top">
                        <td className="p-3 whitespace-nowrap">
                          <p className="font-semibold text-infinity-700">{item.codigo}</p>
                          <p className="text-[11px] text-slate-500">
                            {TIPO_LABELS[item.tipo] ?? item.tipo}
                          </p>
                          <p className="text-xs text-slate-700 mt-0.5">
                            {item.programadoEn
                              ? formatDateTime(item.programadoEn)
                              : "Sin programar"}
                          </p>
                        </td>
                        <td className="p-3">
                          <p className="font-medium text-slate-800">{item.cliente.nombre}</p>
                          <p className="text-xs text-slate-500">{item.cliente.sector}</p>
                          <p className="text-[11px] text-slate-400">{item.cliente.telefono}</p>
                        </td>
                        <td className="p-3 text-xs text-slate-700">{item.tecnicosLabel}</td>
                        <td className="p-3 space-y-1">
                          <ConfirmacionVisitaBadge confirmacion={c} />
                          {c.confirmadoEn && (
                            <p className="text-[11px] text-slate-500">
                              {formatDateTime(c.confirmadoEn)}
                            </p>
                          )}
                          {c.confirmadoPorCanal === "TELEFONICA_SUPERVISOR" && (
                            <p className="text-[11px] text-slate-500">
                              Manual por: {c.confirmadoPorNombre || "Supervisor"}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-xs text-slate-600 max-w-[14rem] space-y-1">
                          {c.personaRecibe && (
                            <p>
                              <strong>Recibe:</strong> {c.personaRecibe}
                            </p>
                          )}
                          {c.horarioSolicitado && (
                            <p className="text-orange-800">
                              <strong>Sugerido:</strong> {c.horarioSolicitado}
                            </p>
                          )}
                          {c.observacionCliente && <p>{c.observacionCliente}</p>}
                          {c.exentoMotivo && (
                            <p className="text-slate-500">
                              <strong>Exención:</strong> {c.exentoMotivo}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {c.estado !== "EXENTO" && (
                              <button
                                type="button"
                                disabled={busy || !item.programadoEn}
                                onClick={() => void reenviar(item)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-infinity-50 text-infinity-700 border border-infinity-200 hover:bg-infinity-100 disabled:opacity-50"
                                title={
                                  item.programadoEn
                                    ? "Generar o reenviar solicitud de confirmación"
                                    : "Programe primero fecha y hora de la visita"
                                }
                              >
                                <Send className="w-3 h-3" />
                                {item.urlConfirmacion ? "Reenviar" : "Generar enlace"}
                              </button>
                            )}

                            {item.mensajeSugerido && (
                              <button
                                type="button"
                                onClick={() => void copiarTexto(item.id, item.mensajeSugerido!)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
                                title="Copiar mensaje con enlace seguro"
                              >
                                {copiadoId === item.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" /> Copiado
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" /> Copiar msg
                                  </>
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={busy || !item.programadoEn}
                              onClick={() => {
                                setManualModal(item);
                                setPersonaRecibe(c.personaRecibe || "");
                                setNotaManual("");
                              }}
                              title={
                                item.programadoEn
                                  ? "Registrar confirmación telefónica"
                                  : "Programe primero fecha y hora de la visita"
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              <PhoneCall className="w-3 h-3" /> Conf. telefónica
                            </button>

                            <Link
                              href={`/supervisor/tickets/${item.id}/editar`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                            >
                              <CalendarClock className="w-3 h-3" /> Reprogramar
                            </Link>

                            {item.permiteExencion && c.estado !== "EXENTO" && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setExentoModal(item);
                                  setMotivoExento("");
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
                              >
                                <ShieldCheck className="w-3 h-3" /> Sin presencia
                              </button>
                            )}

                            {c.estado !== "SIN_RESPUESTA" && c.estado !== "CONFIRMADO" && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void accionSimple(item, "marcar_sin_respuesta")}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
                              >
                                Sin respuesta
                              </button>
                            )}

                            {c.estado === "CONFIRMADO" && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void accionSimple(item, "cancelar")}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                              >
                                <Ban className="w-3 h-3" /> Invalidar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {manualModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-semibold text-slate-900">
              Confirmación telefónica — {manualModal.codigo}
            </h3>
            <p className="text-xs text-slate-500">
              Quedará auditado quién realizó la confirmación telefónica y la fecha/hora exacta.
              El enlace público anterior quedará revocado.
            </p>
            {manualModal.programadoEn && (
              <p className="text-xs font-medium text-slate-700 bg-slate-50 border rounded-lg px-3 py-2">
                Horario confirmado: <strong>{formatDateTime(manualModal.programadoEn)}</strong>
              </p>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Persona que recibirá al técnico *
                </label>
                <input
                  type="text"
                  value={personaRecibe}
                  onChange={(e) => setPersonaRecibe(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Observaciones de la llamada (opcional)
                </label>
                <textarea
                  value={notaManual}
                  onChange={(e) => setNotaManual(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Ej. Cliente confirmó por llamada telefónica"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setManualModal(null)}
                className="px-3 py-2 text-sm border rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busyId === manualModal.id}
                onClick={() => void guardarConfirmacionManual()}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                Registrar confirmación
              </button>
            </div>
          </div>
        </div>
      )}

      {exentoModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-semibold text-slate-900">
              Marcar sin presencia requerida — {exentoModal.codigo}
            </h3>
            <p className="text-xs text-slate-500">
              Permitido únicamente para trabajos externos autorizados ({exentoModal.tipo}). Quedará
              registrado en auditoría.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Motivo de exención *
              </label>
              <textarea
                value={motivoExento}
                onChange={(e) => setMotivoExento(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Ej. Reconexión en caja NAP externa, no requiere ingreso al domicilio"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExentoModal(null)}
                className="px-3 py-2 text-sm border rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busyId === exentoModal.id}
                onClick={() => void guardarExento()}
                className="px-4 py-2 text-sm font-semibold bg-infinity-600 text-white rounded-lg hover:bg-infinity-700 disabled:opacity-50"
              >
                Guardar exención
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
