"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface PublicConfirmacionData {
  ok: true;
  codigoTicket: string;
  tipoServicioLabel: string;
  programadoEn: string | null;
  estado: string;
  estadoLabel: string;
  confirmadoEn: string | null;
  puedeResponder: boolean;
  motivoNoResponder?: string | null;
}

type Modo = "elegir" | "confirmar" | "reprogramar" | "no_disponible";

export default function ConfirmarVisitaPublicPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicConfirmacionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modo, setModo] = useState<Modo>("elegir");
  const [personaRecibe, setPersonaRecibe] = useState("");
  const [horarioSolicitado, setHorarioSolicitado] = useState("");
  const [observacionCliente, setObservacionCliente] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");
  const [errorEnvio, setErrorEnvio] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/confirmacion-visita/public/${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Este enlace no está disponible.");
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("No se pudo conectar con el servidor. Verifique su conexión a internet.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function enviar(accion: "CONFIRMAR" | "SOLICITA_REPROGRAMACION" | "NO_DISPONIBLE") {
    if (enviando) return;
    setErrorEnvio("");
    if (accion === "CONFIRMAR" && personaRecibe.trim().length < 2) {
      setErrorEnvio("Indique el nombre de la persona que recibirá al técnico.");
      return;
    }
    if (accion === "SOLICITA_REPROGRAMACION" && horarioSolicitado.trim().length < 3) {
      setErrorEnvio("Indique un día y horario sugerido para reprogramar la visita.");
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch(`/api/confirmacion-visita/public/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion,
          personaRecibe: personaRecibe.trim() || undefined,
          horarioSolicitado: horarioSolicitado.trim() || undefined,
          observacionCliente: observacionCliente.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorEnvio(json.error || "No se pudo registrar su respuesta.");
        return;
      }
      if (accion === "CONFIRMAR") {
        setMensajeExito(
          "¡Gracias! Su disponibilidad ha sido confirmada. Nuestro técnico podrá iniciar el desplazamiento en el horario programado."
        );
      } else if (accion === "SOLICITA_REPROGRAMACION") {
        setMensajeExito(
          "Solicitud de reprogramación registrada. Nuestro equipo de INFINITY INTERNET coordinará un nuevo horario con usted."
        );
      } else {
        setMensajeExito(
          "Hemos registrado que no estará disponible en ese horario. Nuestro técnico no se desplazará hasta reprogramar con usted."
        );
      }
      setModo("elegir");
      await cargar();
    } catch {
      setErrorEnvio("Error de conexión al enviar su respuesta.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-infinity-600 text-white px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-infinity-100">
            INFINITY INTERNET
          </p>
          <h1 className="text-lg font-bold mt-0.5">Confirmación de visita técnica</h1>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Verificando información de su visita…
            </div>
          ) : error || !data ? (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-rose-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>Enlace no disponible</span>
              </div>
              <p className="text-sm">{error || "No se encontró la solicitud."}</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Orden</span>
                  <span className="font-mono font-semibold text-infinity-700">
                    {data.codigoTicket}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Tipo de visita</span>
                  <span className="font-medium text-slate-800">{data.tipoServicioLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Horario programado</span>
                  <span className="font-semibold text-slate-900 text-right">
                    {data.programadoEn
                      ? formatDateTime(data.programadoEn)
                      : "Por confirmar con soporte"}
                  </span>
                </div>
              </div>

              {mensajeExito && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900 flex gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <p>{mensajeExito}</p>
                </div>
              )}

              {data.estado === "CONFIRMADO" && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-1.5 text-sm text-emerald-900">
                  <p className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Visita confirmada
                  </p>
                  {data.confirmadoEn && (
                    <p className="text-xs text-emerald-800/80">
                      Confirmado el {formatDateTime(data.confirmadoEn)}
                    </p>
                  )}
                </div>
              )}

              {data.estado === "SOLICITA_REPROGRAMACION" && (
                <div className="rounded-xl bg-orange-50 border border-orange-200 p-4 space-y-1 text-sm text-orange-900">
                  <p className="font-semibold flex items-center gap-1.5">
                    <CalendarClock className="w-4 h-4 text-orange-600" />
                    Reprogramación solicitada
                  </p>
                  <p className="text-xs">
                    Nuestro equipo coordinará un nuevo horario con usted.
                  </p>
                </div>
              )}

              {data.estado === "NO_DISPONIBLE" && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-1 text-sm text-red-900">
                  <p className="font-semibold flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-red-600" />
                    Registrado como no disponible
                  </p>
                  <p className="text-xs">
                    Un supervisor se pondrá en contacto para coordinar una nueva visita.
                  </p>
                </div>
              )}

              {!data.puedeResponder && data.motivoNoResponder && (
                <div className="rounded-xl bg-slate-100 border border-slate-200 p-4 text-xs text-slate-700">
                  {data.motivoNoResponder}
                </div>
              )}

              {data.puedeResponder && modo === "elegir" && (
                <div className="space-y-2.5 pt-1">
                  <p className="text-xs text-slate-500">
                    {data.estado === "CONFIRMADO"
                      ? "¿Necesita cambiar su respuesta?"
                      : "Por favor indíquenos si habrá alguien disponible en el domicilio:"}
                  </p>
                  {data.estado !== "CONFIRMADO" && (
                    <button
                      type="button"
                      onClick={() => {
                        setErrorEnvio("");
                        setModo("confirmar");
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Sí, estaremos en casa para recibir al técnico
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setErrorEnvio("");
                      setModo("reprogramar");
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 font-semibold text-sm hover:bg-amber-100"
                  >
                    <CalendarClock className="w-4 h-4" />
                    Solicitar reprogramación de horario
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorEnvio("");
                      setModo("no_disponible");
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white text-red-700 border border-red-200 font-semibold text-sm hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4" />
                    No estaré disponible en este horario
                  </button>
                </div>
              )}

              {modo === "confirmar" && (
                <div className="space-y-3 border-t pt-4">
                  <h2 className="text-sm font-semibold text-slate-800">
                    Confirmar disponibilidad
                  </h2>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      ¿Quién recibirá al técnico? *
                    </label>
                    <input
                      type="text"
                      value={personaRecibe}
                      onChange={(e) => setPersonaRecibe(e.target.value)}
                      placeholder="Nombre de la persona autorizada"
                      maxLength={120}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Indicaciones adicionales (opcional)
                    </label>
                    <textarea
                      value={observacionCliente}
                      onChange={(e) => setObservacionCliente(e.target.value)}
                      placeholder="Ej. Llamar al llegar, timbre dañado, etc."
                      rows={2}
                      maxLength={400}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  {errorEnvio && <p className="text-xs text-red-600">{errorEnvio}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setModo("elegir")}
                      className="px-4 py-2.5 rounded-lg border text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Volver
                    </button>
                    <button
                      type="button"
                      disabled={enviando}
                      onClick={() => enviar("CONFIRMAR")}
                      className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {enviando ? "Confirmando…" : "Confirmar visita"}
                    </button>
                  </div>
                </div>
              )}

              {modo === "reprogramar" && (
                <div className="space-y-3 border-t pt-4">
                  <h2 className="text-sm font-semibold text-slate-800">
                    Solicitar reprogramación
                  </h2>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Día y horario sugerido *
                    </label>
                    <input
                      type="text"
                      value={horarioSolicitado}
                      onChange={(e) => setHorarioSolicitado(e.target.value)}
                      placeholder="Ej. Mañana después de las 14:00"
                      maxLength={140}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Observación (opcional)
                    </label>
                    <textarea
                      value={observacionCliente}
                      onChange={(e) => setObservacionCliente(e.target.value)}
                      rows={2}
                      maxLength={400}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  {errorEnvio && <p className="text-xs text-red-600">{errorEnvio}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setModo("elegir")}
                      className="px-4 py-2.5 rounded-lg border text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Volver
                    </button>
                    <button
                      type="button"
                      disabled={enviando}
                      onClick={() => enviar("SOLICITA_REPROGRAMACION")}
                      className="flex-1 py-2.5 px-4 rounded-lg bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 disabled:opacity-50"
                    >
                      {enviando ? "Enviando…" : "Enviar solicitud"}
                    </button>
                  </div>
                </div>
              )}

              {modo === "no_disponible" && (
                <div className="space-y-3 border-t pt-4">
                  <h2 className="text-sm font-semibold text-slate-800">
                    No estaré disponible
                  </h2>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Motivo o comentario (opcional)
                    </label>
                    <textarea
                      value={observacionCliente}
                      onChange={(e) => setObservacionCliente(e.target.value)}
                      placeholder="Ej. Salí de emergencia, reprogramar luego"
                      rows={2}
                      maxLength={400}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  {errorEnvio && <p className="text-xs text-red-600">{errorEnvio}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setModo("elegir")}
                      className="px-4 py-2.5 rounded-lg border text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Volver
                    </button>
                    <button
                      type="button"
                      disabled={enviando}
                      onClick={() => enviar("NO_DISPONIBLE")}
                      className="flex-1 py-2.5 px-4 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-50"
                    >
                      {enviando ? "Registrando…" : "Confirmar indisponibilidad"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t text-[11px] text-slate-400 flex items-center justify-between">
          <span>INFINITY INTERNET</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> Enlace seguro
          </span>
        </div>
      </div>
    </div>
  );
}
