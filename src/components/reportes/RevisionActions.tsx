"use client";

import { useState } from "react";
import { Loader2, RotateCcw, CheckCircle2 } from "lucide-react";
import {
  ESTADO_REVISION_LABELS,
  MOTIVOS_DEVOLUCION,
  reportePuedeAprobarse,
  reportePuedeDevolverse,
} from "@/lib/revision-reporte";
import type { EstadoRevision } from "@prisma/client";

type HistorialItem = {
  id: string;
  accion: string;
  motivo: string | null;
  observaciones: string | null;
  usuarioNombre: string;
  createdAt: string;
  estadoNuevo: EstadoRevision;
};

type Props = {
  ticketId: string;
  estadoTicket: string;
  estadoRevision: EstadoRevision | null | undefined;
  historial?: HistorialItem[];
  onUpdated?: () => void;
};

export function RevisionActions({
  ticketId,
  estadoTicket,
  estadoRevision,
  historial = [],
  onUpdated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState<string>(MOTIVOS_DEVOLUCION[0]);
  const [motivoOtro, setMotivoOtro] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState<"devolver" | "aprobar" | null>(null);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const puedeDevolver = reportePuedeDevolverse(estadoRevision, estadoTicket);
  const puedeAprobar = reportePuedeAprobarse(estadoRevision);
  const label = estadoRevision
    ? ESTADO_REVISION_LABELS[estadoRevision]
    : estadoTicket === "CERRADO" || estadoTicket === "FINALIZADO"
      ? "Cerrado (sin revisión formal) — puede devolverlo"
      : "Sin flujo de revisión";

  async function devolver() {
    setError("");
    setOkMsg("");
    const motivoFinal =
      motivo === "Otro" ? motivoOtro.trim() : motivo;
    if (!motivoFinal || motivoFinal.length < 3) {
      setError("Indique el motivo de la devolución");
      return;
    }
    setLoading("devolver");
    try {
      const res = await fetch(`/api/tickets/${ticketId}/revision/devolver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivoFinal, observaciones }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al devolver");
      setOkMsg("Reporte devuelto al técnico");
      setOpen(false);
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(null);
    }
  }

  async function aprobar() {
    setError("");
    setOkMsg("");
    setLoading("aprobar");
    try {
      const res = await fetch(`/api/tickets/${ticketId}/revision/aprobar`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al aprobar");
      setOkMsg("Reporte aprobado — cierre oficial");
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-3 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm text-amber-950">Revisión de calidad</h3>
          <p className="text-xs text-amber-900/80 mt-0.5">Estado: {label}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {puedeDevolver && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Devolver para Corrección
            </button>
          )}
          {puedeAprobar && (
            <button
              type="button"
              onClick={() => void aprobar()}
              disabled={loading !== null}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-60"
            >
              {loading === "aprobar" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Aprobar
            </button>
          )}
        </div>
      </div>

      {!puedeDevolver && estadoRevision === "DEVUELTO_CORRECCION" && (
        <p className="text-sm text-amber-900">
          Ya está en manos del técnico para corrección. Cuando reenvíe, podrá
          aprobarlo o volver a devolverlo.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      {okMsg && (
        <p className="text-sm text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2">
          {okMsg}
        </p>
      )}

      {historial.length > 0 && (
        <ul className="text-xs text-slate-600 space-y-1.5 border-t border-amber-200 pt-2">
          {historial.map((h) => (
            <li key={h.id}>
              <span className="font-medium">{h.usuarioNombre}</span>
              {" · "}
              {h.accion}
              {h.motivo ? ` — ${h.motivo}` : ""}
              {" · "}
              {new Date(h.createdAt).toLocaleString("es-EC")}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-4 space-y-3 shadow-xl">
            <h4 className="font-semibold">Devolver para Corrección</h4>
            <p className="text-xs text-slate-500">
              El técnico responsable recibirá una alerta con el motivo.
            </p>
            <div>
              <label className="text-xs text-slate-500">Motivo *</label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full mt-0.5 border rounded-lg px-3 py-2 text-sm"
              >
                {MOTIVOS_DEVOLUCION.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            {motivo === "Otro" && (
              <input
                value={motivoOtro}
                onChange={(e) => setMotivoOtro(e.target.value)}
                placeholder="Describa el motivo…"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            )}
            <div>
              <label className="text-xs text-slate-500">Observaciones adicionales</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                className="w-full mt-0.5 border rounded-lg px-3 py-2 text-sm"
                placeholder="Detalle opcional para el técnico"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm rounded-lg border hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void devolver()}
                disabled={loading !== null}
                className="px-3 py-2 text-sm rounded-lg bg-amber-600 text-white font-medium disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {loading === "devolver" && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Confirmar devolución
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
