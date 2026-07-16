"use client";

import { useState } from "react";
import { AlertTriangle, CalendarClock, Loader2 } from "lucide-react";
import { TIPO_NOVEDAD_LABELS } from "@/lib/novedad-ticket";
import type { TipoNovedadTicket } from "@prisma/client";

type NovedadPendiente = {
  id: string;
  tipo: string;
  tipoLabel: string;
  comentario: string | null;
  fechaSolicitada: string | null;
  createdAt: string;
};

interface NovedadSoportePanelProps {
  ticketId: string;
  cerrado: boolean;
  esInfra: boolean;
  novedadPendiente: NovedadPendiente | null;
  onReportada: () => void;
}

const TIPOS: TipoNovedadTicket[] = [
  "CLIENTE_AUSENTE",
  "SOLICITA_REPROGRAMACION",
  "OTRO",
];

export function NovedadSoportePanel({
  ticketId,
  cerrado,
  esInfra,
  novedadPendiente,
  onReportada,
}: NovedadSoportePanelProps) {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<TipoNovedadTicket>("CLIENTE_AUSENTE");
  const [comentario, setComentario] = useState("");
  const [fechaSolicitada, setFechaSolicitada] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (cerrado || esInfra) return null;

  async function enviar() {
    setLoading(true);
    setError("");
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      /* GPS opcional */
    }

    const res = await fetch(`/api/tickets/${ticketId}/novedad`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        comentario: comentario.trim() || undefined,
        fechaSolicitada: fechaSolicitada || null,
        lat,
        lng,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "No se pudo reportar la novedad");
      return;
    }
    setAbierto(false);
    setComentario("");
    setFechaSolicitada("");
    onReportada();
  }

  if (novedadPendiente) {
    return (
      <section className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">Novedad reportada — en revisión</p>
            <p className="text-sm text-amber-800 mt-1">{novedadPendiente.tipoLabel}</p>
            {novedadPendiente.comentario && (
              <p className="text-sm text-amber-800 mt-1">{novedadPendiente.comentario}</p>
            )}
            {novedadPendiente.fechaSolicitada && (
              <p className="text-sm text-amber-800 mt-1 flex items-center gap-1">
                <CalendarClock className="w-4 h-4" />
                Cliente sugiere: {new Date(novedadPendiente.fechaSolicitada).toLocaleString("es-EC")}
              </p>
            )}
            <p className="text-xs text-amber-700 mt-2">
              El supervisor reprogramará la visita. Espere confirmación antes de volver al domicilio.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div>
        <h2 className="font-semibold">Reportar novedad en la visita</h2>
        <p className="text-xs text-slate-500 mt-1">
          Use si el cliente no está, pide otra fecha u otra situación que impida atender ahora.
        </p>
      </div>

      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="w-full py-2.5 rounded-xl border-2 border-amber-400 text-amber-800 font-medium text-sm hover:bg-amber-50"
        >
          Registrar novedad de soporte
        </button>
      ) : (
        <div className="space-y-3 border-t pt-3">
          <div>
            <label className="text-xs text-slate-500">Tipo de novedad *</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoNovedadTicket)}
              className="w-full mt-0.5 px-3 py-2 border rounded-lg text-sm"
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {TIPO_NOVEDAD_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {tipo === "SOLICITA_REPROGRAMACION" && (
            <div>
              <label className="text-xs text-slate-500">Fecha/hora sugerida por el cliente</label>
              <input
                type="datetime-local"
                value={fechaSolicitada}
                onChange={(e) => setFechaSolicitada(e.target.value)}
                className="w-full mt-0.5 px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-slate-500">Comentario</label>
            <textarea
              rows={3}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Detalle de lo ocurrido en sitio..."
              className="w-full mt-0.5 px-3 py-2 border rounded-lg text-sm resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={enviar}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Enviar al supervisor
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="px-4 py-2.5 rounded-xl border text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
