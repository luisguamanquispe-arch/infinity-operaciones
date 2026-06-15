"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode } from "lucide-react";

interface ReporteQrProps {
  ticketId: string;
  codigo: string;
  tipo: string;
}

/** Payload legible al escanear e identifica la orden en el sistema. */
function buildQrValue(ticketId: string, codigo: string, tipo: string, origin: string) {
  const url = `${origin}/reportes/${ticketId}`;
  return `INFINITY-OS|${codigo}|${tipo}|${ticketId}|${url}`;
}

export function ReporteQr({ ticketId, codigo, tipo }: ReporteQrProps) {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const value = useMemo(
    () =>
      origin
        ? buildQrValue(ticketId, codigo, tipo, origin)
        : `INFINITY-OS|${codigo}|${tipo}|${ticketId}`,
    [ticketId, codigo, tipo, origin]
  );

  return (
    <div
      className="flex flex-col items-center shrink-0 print:break-inside-avoid"
      aria-label={`Código QR de identificación ${codigo}`}
    >
      <div className="rounded-xl border-2 border-slate-200 bg-white p-2.5 shadow-sm print:shadow-none">
        <QRCodeSVG
          value={value}
          size={108}
          level="M"
          marginSize={1}
          bgColor="#ffffff"
          fgColor="#1e293b"
          title={`Orden ${codigo}`}
        />
      </div>
      <div className="mt-2 text-center">
        <p className="font-mono text-sm font-bold text-slate-800 tracking-wide">{codigo}</p>
        <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1 mt-0.5">
          <QrCode className="w-3 h-3" />
          ID orden de servicio
        </p>
      </div>
    </div>
  );
}
