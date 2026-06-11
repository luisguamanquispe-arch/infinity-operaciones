"use client";

import { useState } from "react";
import { PenLine, MapPin } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface FirmaReporteProps {
  firma: {
    nombreCliente: string;
    cedula: string;
    imagenSrc: string;
    firmadoEn: string;
    lat?: number | null;
    lng?: number | null;
  };
}

function resolveSrc(src: string): string {
  if (src.startsWith("data:") || src.startsWith("http")) return src;
  if (typeof window !== "undefined" && src.startsWith("/")) {
    return `${window.location.origin}${src}`;
  }
  return src;
}

export function FirmaReporte({ firma }: FirmaReporteProps) {
  const [error, setError] = useState(false);
  const src = resolveSrc(firma.imagenSrc);

  return (
    <div className="bg-white rounded-xl border p-4 print:break-inside-avoid">
      <h3 className="font-semibold flex items-center gap-2 text-sm mb-3">
        <PenLine className="w-4 h-4" />
        Firma del cliente
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
          {!error ? (
            <img
              src={src}
              alt={`Firma de ${firma.nombreCliente}`}
              className="max-h-40 max-w-full object-contain"
              onError={() => setError(true)}
            />
          ) : (
            <p className="text-sm text-slate-400 text-center px-4">
              Imagen de firma no disponible en el servidor
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
