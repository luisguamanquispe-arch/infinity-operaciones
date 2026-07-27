"use client";

import { FileDown } from "lucide-react";

type Variant = "header" | "link" | "icon";

interface DescargarPdfClienteProps {
  ticketId: string;
  codigo?: string;
  /** Si true, usa /api/reportes/:id/pdf (supervisor). Si false, /api/tickets/:id/reporte-pdf (técnico). */
  desdeReportes?: boolean;
  variant?: Variant;
  className?: string;
}

export function DescargarPdfCliente({
  ticketId,
  codigo,
  desdeReportes = true,
  variant = "header",
  className = "",
}: DescargarPdfClienteProps) {
  const href = desdeReportes
    ? `/api/reportes/${ticketId}/pdf`
    : `/api/tickets/${ticketId}/reporte-pdf`;

  const base =
    variant === "header"
      ? "inline-flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium"
      : variant === "link"
        ? "inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline whitespace-nowrap"
        : "inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${className}`.trim()}
      title={codigo ? `PDF cliente ${codigo}` : "PDF para cliente"}
    >
      <FileDown className="w-4 h-4 shrink-0" />
      {variant !== "icon" && "PDF cliente"}
    </a>
  );
}
