"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";

interface EnviarReporteSoporteProps {
  ticketId: string;
  resumenTrabajo: string | null | undefined;
  cerrado: boolean;
  onResumenChange?: (value: string) => void;
}

export function EnviarReporteSoporte({
  ticketId,
  resumenTrabajo,
  cerrado,
  onResumenChange,
}: EnviarReporteSoporteProps) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function descargarPdf() {
    setLoading(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch(`/api/tickets/${ticketId}/reporte-pdf`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "No se pudo generar el PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte-soporte.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("PDF generado y descargado");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al descargar");
    } finally {
      setLoading(false);
    }
  }

  const resumenOk = (resumenTrabajo?.trim().length ?? 0) >= 10;

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <h3 className="font-semibold">Reporte PDF para el cliente</h3>
      <p className="text-xs text-slate-500">
        Genere un PDF consolidado del soporte (resumen, potencia óptica, materiales, firma y
        aceptación) para entregar al cliente.
      </p>

      {onResumenChange && !cerrado && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">
            Resumen del soporte / trabajo efectuado *
          </label>
          <textarea
            value={resumenTrabajo ?? ""}
            onChange={(e) => onResumenChange(e.target.value)}
            rows={4}
            placeholder="Ej.: Se revisó ONU, se limpió conector, potencia RX -18 dBm, servicio restablecido. Cliente conforme."
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>
      )}

      {cerrado && resumenTrabajo && (
        <div className="rounded-lg bg-slate-50 border p-3 text-sm text-slate-700 whitespace-pre-wrap">
          {resumenTrabajo}
        </div>
      )}

      <button
        type="button"
        onClick={descargarPdf}
        disabled={loading || !resumenOk}
        className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-infinity-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
        Generar PDF para cliente
      </button>

      {!resumenOk && (
        <p className="text-xs text-amber-700">
          Escriba el resumen del trabajo (mín. 10 caracteres) para habilitar el PDF.
        </p>
      )}
      {msg && <p className="text-xs text-emerald-700">{msg}</p>}
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
