"use client";

import { PhotoCapture } from "@/components/PhotoCapture";
import { SignatureCapture } from "@/components/SignatureCapture";
import { EnviarReporteSoporte } from "@/components/tecnico/EnviarReporteSoporte";
import {
  FOTOS_EXPRESS,
  FOTO_LABELS_EXPRESS,
  trabajoExpressTexto,
} from "@/lib/soporte-express";
import type { TrabajoExpress } from "@prisma/client";
import type { ReactNode } from "react";

interface FotoExisting {
  id: string;
  tipo: string;
  url: string;
  imagenSrc?: string;
}

interface FirmaExisting {
  imagenUrl: string;
  imagenSrc?: string;
  nombreCliente: string;
  cedula: string;
  aceptacionCondiciones?: boolean;
  textoAceptacion?: string | null;
}

interface ExpressOrdenPanelProps {
  ticketId: string;
  trabajoExpress?: TrabajoExpress | null;
  trabajoExpressOtro?: string | null;
  resumenTrabajo: string;
  observaciones: string;
  onResumenChange: (value: string) => void;
  onObservacionesChange: (value: string) => void;
  fotoMap: Record<string, FotoExisting | undefined>;
  onFotoUploaded: () => void;
  firma: FirmaExisting | null | undefined;
  clienteNombre: string;
  clienteCedula: string;
  onFirmaSaved: () => void;
  cerrado: boolean;
  /** header = banner+trabajo; evidence = fotos+firma+pdf; full = todo */
  mode?: "header" | "evidence" | "full";
  materialesSlot?: ReactNode;
}

/**
 * Formulario simplificado de Soporte Express.
 */
export function ExpressOrdenPanel({
  ticketId,
  trabajoExpress,
  trabajoExpressOtro,
  resumenTrabajo,
  observaciones,
  onResumenChange,
  onObservacionesChange,
  fotoMap,
  onFotoUploaded,
  firma,
  clienteNombre,
  clienteCedula,
  onFirmaSaved,
  cerrado,
  mode = "full",
  materialesSlot,
}: ExpressOrdenPanelProps) {
  const trabajoLabel = trabajoExpressTexto(trabajoExpress, trabajoExpressOtro);
  const showHeader = mode === "header" || mode === "full";
  const showEvidence = mode === "evidence" || mode === "full";

  return (
    <>
      {showHeader && (
        <>
          <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
            <p className="font-semibold text-amber-950">Soporte Express</p>
            <p className="text-sm text-amber-900/80">
              Formulario simplificado. Debe adjuntar 2 fotos obligatorias (serie de equipos y
              cliente satisfecho). En materiales puede registrar marca, modelo y serie de los
              equipos entregados. La firma es opcional.
            </p>
            {trabajoLabel && (
              <p className="text-sm mt-2">
                <span className="text-amber-800/70">Trabajo asignado:</span>{" "}
                <strong>{trabajoLabel}</strong>
              </p>
            )}
          </section>

          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h3 className="font-semibold">Trabajo realizado *</h3>
            <textarea
              rows={4}
              value={resumenTrabajo}
              onChange={(e) => onResumenChange(e.target.value)}
              disabled={cerrado}
              placeholder="Describa brevemente lo realizado (mín. 10 caracteres)…"
              className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-slate-50"
            />
            <div>
              <label className="text-xs text-slate-500">Observaciones (opcional)</label>
              <textarea
                rows={2}
                value={observaciones}
                onChange={(e) => onObservacionesChange(e.target.value)}
                disabled={cerrado}
                placeholder="Notas adicionales…"
                className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5 disabled:bg-slate-50"
              />
            </div>
          </section>

          {materialesSlot}
        </>
      )}

      {showEvidence && (
        <>
          <section className="bg-white rounded-xl border p-4 space-y-2">
            <h3 className="font-semibold">Fotografías obligatorias (2)</h3>
            <p className="text-xs text-slate-500">
              1. Serie de los equipos · 2. Cliente satisfecho
            </p>
            {FOTOS_EXPRESS.map((t) => (
              <PhotoCapture
                key={t}
                ticketId={ticketId}
                tipo={t}
                label={FOTO_LABELS_EXPRESS[t]}
                existing={fotoMap[t]}
                onUploaded={onFotoUploaded}
                readOnly={cerrado}
              />
            ))}
          </section>

          {!cerrado && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500 px-1">Firma del cliente (opcional)</p>
              <SignatureCapture
                ticketId={ticketId}
                existing={firma}
                clienteNombre={clienteNombre}
                clienteCedula={clienteCedula}
                onSaved={onFirmaSaved}
              />
            </div>
          )}
          {cerrado && firma && (
            <section className="bg-white rounded-xl border p-4 space-y-1 text-sm">
              <h3 className="font-semibold">Firma del cliente</h3>
              <p>
                {firma.nombreCliente} — {firma.cedula}
              </p>
            </section>
          )}

          <EnviarReporteSoporte
            ticketId={ticketId}
            resumenTrabajo={resumenTrabajo}
            cerrado={cerrado}
          />
        </>
      )}
    </>
  );
}
