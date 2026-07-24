"use client";

import { useState } from "react";
import { PenLine, MapPin, CheckCircle2, Camera } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import {
  LABEL_CHECKBOX_ACEPTACION,
  TEXTO_ACEPTACION_SOPORTE,
} from "@/lib/aceptacion-soporte";

interface FirmaReporteProps {
  firma: {
    nombreCliente: string;
    cedula: string;
    imagenSrc: string;
    firmadoEn: string;
    lat?: number | null;
    lng?: number | null;
    aceptacionCondiciones?: boolean;
    textoAceptacion?: string | null;
    aceptadoEn?: string | null;
  };
  /** Foto CLIENTE_CONFORME (cliente satisfecho) */
  fotoClienteConforme?: {
    url: string;
    tomadaEn?: string;
  } | null;
}

function resolveSrc(src: string): string {
  if (src.startsWith("data:") || src.startsWith("http")) return src;
  if (typeof window !== "undefined" && src.startsWith("/")) {
    return `${window.location.origin}${src}`;
  }
  return src;
}

export function FirmaReporte({ firma, fotoClienteConforme }: FirmaReporteProps) {
  const [errorFirma, setErrorFirma] = useState(false);
  const [errorFoto, setErrorFoto] = useState(false);
  const srcFirma = resolveSrc(firma.imagenSrc);
  const srcFoto = fotoClienteConforme?.url ? resolveSrc(fotoClienteConforme.url) : null;
  const texto = firma.textoAceptacion || TEXTO_ACEPTACION_SOPORTE;

  return (
    <div className="bg-white rounded-xl border p-4 print:break-inside-avoid space-y-4">
      <h3 className="font-semibold flex items-center gap-2 text-sm">
        <PenLine className="w-4 h-4" />
        Firma y aceptación del cliente
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1 text-sm">
          <p className="font-medium text-slate-800">{firma.nombreCliente}</p>
          <p className="text-slate-600">Cédula: {firma.cedula}</p>
          <p className="text-xs text-slate-400">
            Firmado: {formatDateTime(firma.firmadoEn)}
          </p>
          {firma.lat != null && firma.lng != null && (
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              GPS: {firma.lat.toFixed(5)}, {firma.lng.toFixed(5)}
            </p>
          )}
        </div>

        <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-3 min-h-[140px] flex items-center justify-center">
          {!errorFirma ? (
            <img
              src={srcFirma}
              alt={`Firma de ${firma.nombreCliente}`}
              className="max-h-40 max-w-full object-contain"
              onError={() => setErrorFirma(true)}
            />
          ) : (
            <p className="text-sm text-slate-400 text-center px-4">
              Imagen de firma no disponible en el servidor
            </p>
          )}
        </div>
      </div>

      {firma.aceptacionCondiciones ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2 print:border print:bg-white">
          <p className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Aceptación de condiciones
          </p>
          <p className="text-xs leading-relaxed text-slate-700">{texto}</p>
          <p className="text-xs font-medium text-emerald-900 flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border border-emerald-600 bg-emerald-600 text-white text-[10px]">
              ✓
            </span>
            {LABEL_CHECKBOX_ACEPTACION}
          </p>
          {firma.aceptadoEn && (
            <p className="text-[11px] text-slate-500">
              Aceptado: {formatDateTime(firma.aceptadoEn)}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Esta firma no registra aceptación de condiciones (orden anterior al cambio).
        </div>
      )}

      {srcFoto && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Camera className="w-4 h-4" />
            Foto cliente satisfecho
          </p>
          <div className="bg-slate-50 border rounded-xl p-2 flex justify-center min-h-[160px]">
            {!errorFoto ? (
              <img
                src={srcFoto}
                alt="Cliente satisfecho / conforme"
                className="max-h-56 max-w-full object-contain rounded-lg"
                onError={() => setErrorFoto(true)}
              />
            ) : (
              <p className="text-sm text-slate-400 self-center">Foto no disponible</p>
            )}
          </div>
          {fotoClienteConforme?.tomadaEn && (
            <p className="text-[11px] text-slate-500">
              Tomada: {formatDateTime(fotoClienteConforme.tomadaEn)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
