"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import type { MotivoJustificacionTecnica } from "@prisma/client";
import {
  MOTIVOS_JUSTIFICACION,
  MOTIVO_JUSTIFICACION_LABELS,
} from "@/lib/justificacion-tecnica";

type Props = {
  ticketId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: (codigo: string) => void;
};

export function JustificacionTecnicaModal({
  ticketId,
  open,
  onClose,
  onSuccess,
}: Props) {
  const [motivo, setMotivo] = useState<MotivoJustificacionTecnica | "">("");
  const [motivoOtro, setMotivoOtro] = useState("");
  const [justificacion, setJustificacion] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!motivo) {
      setError("Seleccione el motivo");
      return;
    }
    if (motivo === "OTRO" && motivoOtro.trim().length < 3) {
      setError("Indique el detalle del motivo");
      return;
    }
    if (justificacion.trim().length < 15) {
      setError("La justificación técnica es obligatoria (mín. 15 caracteres)");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/cerrar-justificacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo,
          motivoOtro: motivo === "OTRO" ? motivoOtro : undefined,
          justificacion,
          observaciones: observaciones || undefined,
          fotoUrl: fotoUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo enviar");
      onSuccess(data.codigo || ticketId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/45 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white">
          <h3 className="font-semibold text-slate-900">
            Cerrar con Justificación Técnica
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={enviar} className="p-4 space-y-3">
          <p className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Use esta opción solo si no pudo ejecutar el trabajo. El soporte quedará en{" "}
            <strong>Pendiente de Revisión</strong> hasta que el supervisor apruebe.
          </p>

          <div>
            <label className="text-xs text-slate-500">Motivo *</label>
            <select
              required
              value={motivo}
              onChange={(e) =>
                setMotivo(e.target.value as MotivoJustificacionTecnica | "")
              }
              className="w-full mt-0.5 border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Seleccionar…</option>
              {MOTIVOS_JUSTIFICACION.map((m) => (
                <option key={m} value={m}>
                  {MOTIVO_JUSTIFICACION_LABELS[m]}
                </option>
              ))}
            </select>
          </div>

          {motivo === "OTRO" && (
            <div>
              <label className="text-xs text-slate-500">Detalle del motivo *</label>
              <input
                value={motivoOtro}
                onChange={(e) => setMotivoOtro(e.target.value)}
                className="w-full mt-0.5 border rounded-lg px-3 py-2 text-sm"
                placeholder="Describa el motivo…"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-slate-500">Justificación técnica *</label>
            <textarea
              required
              rows={4}
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              className="w-full mt-0.5 border rounded-lg px-3 py-2 text-sm"
              placeholder="Explique por qué no pudo completar el soporte…"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">
              URL de fotografía (opcional)
            </label>
            <input
              value={fotoUrl}
              onChange={(e) => setFotoUrl(e.target.value)}
              className="w-full mt-0.5 border rounded-lg px-3 py-2 text-sm"
              placeholder="Si ya subió evidencia, pegue el enlace o deje vacío"
            />
            <p className="text-[11px] text-slate-400 mt-0.5">
              Puede adjuntar fotos en la sección de evidencia antes de enviar.
            </p>
          </div>

          <div>
            <label className="text-xs text-slate-500">Observaciones (opcional)</label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full mt-0.5 border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm rounded-lg border hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-2 text-sm rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Enviar a revisión
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
