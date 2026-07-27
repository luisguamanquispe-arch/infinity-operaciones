"use client";

import { FileDown } from "lucide-react";

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
  const resumenOk = (resumenTrabajo?.trim().length ?? 0) >= 10;
  const href = `/api/tickets/${ticketId}/reporte-pdf`;

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

      {resumenOk ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-infinity-600 text-white rounded-lg text-sm font-medium hover:bg-infinity-700"
        >
          <FileDown className="w-4 h-4" />
          Generar PDF para cliente
        </a>
      ) : (
        <button
          type="button"
          disabled
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-infinity-600 text-white rounded-lg text-sm font-medium opacity-50 cursor-not-allowed"
        >
          <FileDown className="w-4 h-4" />
          Generar PDF para cliente
        </button>
      )}

      {!resumenOk && (
        <p className="text-xs text-amber-700">
          Escriba el resumen del trabajo (mín. 10 caracteres) para habilitar el PDF.
        </p>
      )}
    </div>
  );
}
